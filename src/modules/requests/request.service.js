/**
 * Dịch vụ xử lý Phiếu Yêu cầu SV (Báo hỏng / Chuyển phòng / Trả phòng — API.md §8, §9).
 *
 * Quy tắc cốt lõi:
 *   - Sinh viên phải có hợp đồng đang ở (`active`) mới được gửi phiếu.
 *   - Chỉ `manager` mới được phê duyệt chuyển phòng (`transfer` -> `approved` | `completed`).
 *   - Duyệt chuyển phòng tự khóa 1 chỗ ở phòng mới nguyên tử (`lockRoomSlot`), cập nhật `Contract.roomId`
 *     và giải phóng 1 chỗ ở phòng cũ (`releaseRoomSlot`).
 *   - Mọi cập nhật trạng thái đều bắn Chuông thông báo tới sinh viên.
 */

const Request = require('./request.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const Room = require('../rooms/room.model');
const Building = require('../rooms/building.model');
const Student = require('../students/student.model');
const contractService = require('../contracts/contract.service');
const notificationService = require('../notifications/notification.service');
const { REQUEST_TYPE, REPAIR_CATEGORY } = require('../../shared/constants/enums');
const { fail, fieldErrors, paginate, matches, isObjectId } = require('../../core/utils/http');
const { createWithCode, yearPrefix } = require('../../core/utils/code-generator');
const {
  loadCtx,
  studentRef,
  roomRef,
  byId,
  contractStatusOf,
  roomUtilityFilterForContract,
} = require('../../shared/views');

const TERMINAL_STATUSES = new Set(['completed', 'rejected', 'cancelled']);
const ALLOWED_OPS_STATUSES = ['in_progress', 'completed', 'rejected'];
const TYPE_LABEL = { repair: 'Báo hỏng sửa chữa', transfer: 'Xin chuyển phòng', checkout: 'Đăng ký trả phòng' };
const STATUS_LABEL = {
  in_progress: 'đang được tiếp nhận xử lý',
  completed: 'đã hoàn tất xử lý',
  rejected: 'đã bị từ chối',
};

/** 2A: Chuyển phòng giữa kỳ phải cùng hạng, cùng sức chứa và cùng đơn giá/cọc */
const isSameRoomClass = (cur, tgt) =>
  Boolean(cur && tgt) &&
  (cur.roomTier || 'standard') === (tgt.roomTier || 'standard') &&
  Number(cur.capacity) === Number(tgt.capacity) &&
  Number(cur.pricePerMonth) === Number(tgt.pricePerMonth) &&
  Number(cur.depositAmount) === Number(tgt.depositAmount);

/** Hóa đơn chưa thanh toán chặn chuyển phòng (cá nhân + điện nước phòng hiện tại từ tháng Check-in) */
async function blockingInvoicesOf(contract) {
  const utilFilter = roomUtilityFilterForContract(contract);
  return Invoice.find({
    status: 'unpaid',
    $or: [{ studentId: contract.studentId, scope: 'personal' }, ...(utilFilter ? [utilFilter] : [])],
  }).lean();
}

async function requestViews(list) {
  const contractIds = list.map((r) => r.contractId).filter(Boolean);
  const contracts = byId(contractIds.length ? await Contract.find({ _id: { $in: contractIds } }).select('contractCode').lean() : []);
  const ctx = await loadCtx({
    roomIds: list.flatMap((r) => [r.roomId, r.targetRoomId]),
    studentIds: list.map((r) => r.studentId),
  });

  return list.map((r) => {
    const room = roomRef(ctx.rooms.get(String(r.roomId)), ctx);
    const targetRoom = r.targetRoomId ? roomRef(ctx.rooms.get(String(r.targetRoomId)), ctx) : null;
    return {
      id: String(r._id),
      requestCode: r.requestCode,
      type: r.type,
      status: r.status,
      title: r.title,
      description: r.description,
      repairCategory: r.repairCategory ?? null,
      attachmentUrl: r.attachmentUrl ?? null,
      student: studentRef(ctx.students.get(String(r.studentId))),
      contractId: String(r.contractId),
      contractCode: contracts.get(String(r.contractId))?.contractCode ?? null,
      room,
      campus: room?.campus ?? null,
      targetRoom,
      handlerNote: r.handlerNote ?? '',
      handledByName: r.handledByName ?? null,
      handledAt: r.handledAt ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

/** Portal SV: POST /api/portal/requests */
async function createByStudent(student, body = {}) {
  const contract = await Contract.findOne({ studentId: student._id, status: 'active' }).lean();
  if (!contract) {
    fail(422, 'NO_ACTIVE_RESIDENCE', 'Bạn cần có hợp đồng nội trú đang hiệu lực mới có thể gửi yêu cầu');
  }

  const type = String(body.type || '').trim();
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const errors = [];
  if (!REQUEST_TYPE.includes(type)) errors.push({ field: 'type', message: 'Loại yêu cầu phải là repair, transfer hoặc checkout' });
  if (!title) errors.push({ field: 'title', message: 'Nhập tiêu đề yêu cầu' });
  if (!description) errors.push({ field: 'description', message: 'Nhập mô tả chi tiết yêu cầu' });

  let repairCategory = null;
  if (type === 'repair') {
    if (!contract.checkedInAt) {
      fail(422, 'NOT_CHECKED_IN', 'Bạn cần hoàn tất QR Check-in nhận phòng tại văn phòng KTX trước khi gửi phiếu báo hỏng');
    }
    repairCategory = body.repairCategory ? String(body.repairCategory).trim() : 'other';
    if (!REPAIR_CATEGORY.includes(repairCategory)) {
      errors.push({ field: 'repairCategory', message: 'Danh mục sự cố không hợp lệ (electric, water, ac, furniture, other)' });
    }
  }

  let targetRoomId = null;
  if (type === 'transfer') {
    if (!contract.checkedInAt) {
      fail(422, 'NOT_CHECKED_IN', 'Bạn cần hoàn tất QR Check-in nhận phòng tại văn phòng KTX trước khi xin chuyển phòng');
    }
    if (contractStatusOf(contract) === 'expired') {
      fail(422, 'CONTRACT_EXPIRED', 'Hợp đồng đã hết hạn, không thể xin chuyển phòng. Vui lòng thanh lý trả phòng hoặc đăng ký kỳ mới');
    }
    const unpaid = await blockingInvoicesOf(contract);
    if (unpaid.length > 0) {
      fail(422, 'OUTSTANDING_INVOICES', `Còn ${unpaid.length} hóa đơn cá nhân hoặc điện nước phòng hiện tại chưa thanh toán, chưa thể xin chuyển phòng`, {
        invoices: unpaid.map((i) => ({ id: String(i._id), invoiceCode: i.invoiceCode, type: i.type, amount: i.amount })),
      });
    }

    const existing = await Request.exists({
      studentId: student._id,
      type: 'transfer',
      status: { $in: ['pending', 'in_progress'] },
    });
    if (existing) fail(409, 'DUPLICATE_ENTRY', 'Bạn đang có một yêu cầu chuyển phòng chờ xử lý');

    if (body.targetRoomId) {
      if (!isObjectId(body.targetRoomId)) {
        errors.push({ field: 'targetRoomId', message: 'Phòng muốn chuyển không hợp lệ' });
      } else {
        const [currentRoom, targetRoom] = await Promise.all([
          Room.findById(contract.roomId).lean(),
          Room.findById(body.targetRoomId).lean(),
        ]);
        if (!targetRoom) {
          errors.push({ field: 'targetRoomId', message: 'Không tìm thấy phòng muốn chuyển sang' });
        } else if (String(targetRoom._id) === String(contract.roomId)) {
          errors.push({ field: 'targetRoomId', message: 'Bạn đang ở chính phòng này' });
        } else if (targetRoom.status !== 'active') {
          errors.push({ field: 'targetRoomId', message: 'Phòng đích đang bảo trì' });
        } else if (targetRoom.gender && targetRoom.gender !== student.gender) {
          errors.push({ field: 'targetRoomId', message: 'Phòng đích không cùng giới tính' });
        } else if ((targetRoom.occupiedCount || 0) >= targetRoom.capacity) {
          errors.push({ field: 'targetRoomId', message: 'Phòng đích hiện đã hết chỗ trống' });
        } else if (!isSameRoomClass(currentRoom, targetRoom)) {
          errors.push({ field: 'targetRoomId', message: 'Trong cùng kỳ hợp đồng chỉ được chuyển sang phòng cùng hạng, cùng sức chứa và cùng đơn giá' });
        } else {
          const [curBuilding, tgtBuilding] = await Promise.all([
            currentRoom ? Building.findById(currentRoom.buildingId).lean() : null,
            Building.findById(targetRoom.buildingId).lean(),
          ]);
          if (!tgtBuilding?.isActive) {
            errors.push({ field: 'targetRoomId', message: 'Tòa nhà đích đã ngừng hoạt động' });
          } else if (curBuilding && tgtBuilding.campus !== curBuilding.campus) {
            errors.push({ field: 'targetRoomId', message: 'Chỉ hỗ trợ xin chuyển phòng trong cùng cơ sở KTX' });
          } else {
            targetRoomId = targetRoom._id;
          }
        }
      }
    }
  }

  if (type === 'checkout') {
    const existing = await Request.exists({
      studentId: student._id,
      type: 'checkout',
      status: { $in: ['pending', 'in_progress'] },
    });
    if (existing) fail(409, 'DUPLICATE_ENTRY', 'Bạn đang có một yêu cầu trả phòng chờ xử lý');
  }

  if (errors.length) fieldErrors(errors);

  const created = await createWithCode(Request, 'requestCode', yearPrefix('REQ'), (requestCode) => ({
    requestCode,
    studentId: student._id,
    contractId: contract._id,
    roomId: contract.roomId,
    type,
    title,
    description,
    repairCategory,
    targetRoomId,
    attachmentUrl: body.attachmentUrl ? String(body.attachmentUrl).trim() : null,
    status: 'pending',
  }));

  const [view] = await requestViews([created.toObject()]);
  return {
    data: view,
    message: `Đã gửi phiếu ${TYPE_LABEL[type]} (${created.requestCode})`,
    status: 201,
  };
}

/** Portal SV: GET /api/portal/requests */
async function listByStudent(studentId, q = {}) {
  const filter = { studentId };
  if (q.type) filter.type = q.type;
  if (q.status) filter.status = q.status;
  const rows = await requestViews(await Request.find(filter).sort({ createdAt: -1 }).lean());
  return { data: paginate(rows, { limit: 50, ...q }) };
}

/** Portal SV: PATCH /api/portal/requests/:id/cancel */
async function cancelByStudent(studentId, requestId) {
  const doc = isObjectId(requestId) ? await Request.findOne({ _id: requestId, studentId }).lean() : null;
  if (!doc) fail(404, 'NOT_FOUND', 'Không tìm thấy phiếu yêu cầu');
  if (doc.status !== 'pending') {
    fail(409, 'REQUEST_NOT_CANCELLABLE', 'Chỉ có thể hủy phiếu khi đang ở trạng thái chờ xử lý (pending)');
  }
  const updated = await Request.findOneAndUpdate(
    { _id: doc._id, status: 'pending' },
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'REQUEST_NOT_CANCELLABLE', 'Phiếu đã được xử lý');
  const [view] = await requestViews([updated]);
  return { data: view, message: 'Đã hủy phiếu yêu cầu' };
}

/** Ops: GET /api/requests?type=&status=&campus=&search=&page=&limit= */
async function list(q = {}) {
  const filter = {};
  if (q.type) filter.type = q.type;
  let scoped = await requestViews(await Request.find(filter).sort({ createdAt: -1 }).lean());
  if (q.campus) scoped = scoped.filter((r) => r.campus === q.campus);
  scoped = scoped.filter((r) =>
    matches(q.search, [
      r.requestCode,
      r.title,
      r.student?.studentCode,
      r.student?.fullName,
      r.room?.roomNumber,
      r.room && `${r.room.buildingCode}-${r.room.roomNumber}`,
    ])
  );

  const count = (s) => scoped.filter((r) => r.status === s).length;
  const summary = {
    total: scoped.length,
    pending: count('pending'),
    in_progress: count('in_progress'),
    approved: count('approved'),
    completed: count('completed'),
    rejected: count('rejected'),
    cancelled: count('cancelled'),
  };
  const rows = q.status ? scoped.filter((r) => r.status === q.status) : scoped;
  return { data: paginate(rows, q, { summary }) };
}

/** Ops: PATCH /api/requests/:id/status */
async function updateStatus(id, body = {}, actor) {
  const doc = isObjectId(id) ? await Request.findById(id).lean() : null;
  if (!doc) fail(404, 'NOT_FOUND', 'Không tìm thấy phiếu yêu cầu');
  if (TERMINAL_STATUSES.has(doc.status)) {
    fail(409, 'INVALID_STATUS_TRANSITION', `Phiếu ${doc.requestCode} đã kết thúc (${doc.status}), không thể cập nhật thêm`);
  }

  const nextStatus = String(body.status || '').trim();
  if (!ALLOWED_OPS_STATUSES.includes(nextStatus)) {
    fieldErrors([{ field: 'status', message: 'Trạng thái phải là in_progress, completed hoặc rejected' }]);
  }
  const handlerNote = String(body.handlerNote ?? doc.handlerNote ?? '').trim();
  if (nextStatus === 'rejected' && !handlerNote) {
    fieldErrors([{ field: 'handlerNote', message: 'Nhập lý do từ chối phiếu yêu cầu' }]);
  }

  // Một nguồn sự thật cho trả phòng: không cho đánh dấu hoàn tất suông ở màn Yêu cầu
  if (doc.type === 'checkout' && nextStatus === 'completed') {
    fail(
      409,
      'USE_CONTRACT_TERMINATE',
      'Không hoàn tất trực tiếp trên phiếu trả phòng. Vui lòng mở Hợp đồng của sinh viên và bấm Thanh lý hợp đồng để kiểm tra nợ, nhả chỗ và tự động đóng phiếu này.'
    );
  }

  let finalTargetRoomId = doc.targetRoomId;
  let transferInfoText = '';

  // Phê duyệt chuyển phòng (`transfer` -> `completed`): CHỈ Manager + Hoán đổi phòng nguyên tử 1 lần duy nhất
  if (doc.type === 'transfer' && nextStatus === 'completed') {
    if (actor.role !== 'manager') {
      fail(403, 'FORBIDDEN', 'Chỉ Trưởng ban QLKTX (Manager) mới có quyền phê duyệt chuyển phòng');
    }

    const chosenRoomId = body.targetRoomId || doc.targetRoomId;
    if (!isObjectId(chosenRoomId)) {
      fieldErrors([{ field: 'targetRoomId', message: 'Chọn phòng đích để phê duyệt chuyển phòng' }]);
    }

    const [contract, student, targetRoom] = await Promise.all([
      Contract.findById(doc.contractId).lean(),
      Student.findById(doc.studentId).lean(),
      Room.findById(chosenRoomId).lean(),
    ]);

    if (!contract || contract.status !== 'active') {
      fail(409, 'CONTRACT_NOT_ACTIVE', 'Hợp đồng của sinh viên không còn ở trạng thái hiệu lực');
    }
    if (!contract.checkedInAt) {
      fail(422, 'NOT_CHECKED_IN', 'Sinh viên chưa làm thủ tục Check-in nhận phòng, không thể chuyển phòng');
    }
    if (contractStatusOf(contract) === 'expired') {
      fail(422, 'CONTRACT_EXPIRED', 'Hợp đồng của sinh viên đã hết hạn, không thể duyệt chuyển phòng');
    }
    const unpaid = await blockingInvoicesOf(contract);
    if (unpaid.length > 0) {
      fail(422, 'OUTSTANDING_INVOICES', `Còn ${unpaid.length} hóa đơn cá nhân hoặc điện nước phòng cũ chưa thanh toán, chưa thể chuyển phòng`, {
        invoices: unpaid.map((i) => ({ id: String(i._id), invoiceCode: i.invoiceCode, type: i.type, amount: i.amount })),
      });
    }

    if (!targetRoom) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng đích');
    const [currentRoom, targetBuilding] = await Promise.all([
      Room.findById(contract.roomId).lean(),
      Building.findById(targetRoom.buildingId).lean(),
    ]);
    if (targetRoom.status !== 'active' || !targetBuilding?.isActive) {
      fail(422, 'ROOM_NOT_AVAILABLE', 'Phòng đích đang bảo trì hoặc tòa ngừng hoạt động');
    }
    if (student && targetRoom.gender && targetRoom.gender !== student.gender) {
      fail(422, 'GENDER_MISMATCH', 'Phòng đích không cùng giới tính với sinh viên');
    }
    if (String(targetRoom._id) === String(contract.roomId)) {
      fail(422, 'VALIDATION_ERROR', 'Sinh viên đang ở chính phòng đích này');
    }
    if (!isSameRoomClass(currentRoom, targetRoom)) {
      fail(422, 'ROOM_TIER_MISMATCH', 'Trong cùng kỳ hợp đồng chỉ phê duyệt chuyển sang phòng cùng hạng, cùng sức chứa và cùng đơn giá');
    }

    // 1. Khóa nguyên tử 1 chỗ ở phòng mới (tự gán giới tính nếu phòng đích đang trống)
    const lockedNew = await contractService.lockRoomSlot(targetRoom._id, student?.gender);
    if (!lockedNew) {
      fail(409, 'ROOM_FULL', `Phòng ${targetBuilding.code}-${targetRoom.roomNumber} vừa hết chỗ trống`);
    }

    // 2. Cập nhật hợp đồng sang phòng mới (hoàn tác nếu hợp đồng đổi trạng thái song song)
    const oldRoomId = contract.roomId;
    const movedContract = await Contract.findOneAndUpdate(
      { _id: contract._id, status: 'active' },
      { $set: { roomId: targetRoom._id } },
      { returnDocument: 'after' }
    ).lean();

    if (!movedContract) {
      await contractService.releaseRoomSlot(targetRoom._id);
      fail(409, 'CONTRACT_NOT_ACTIVE', 'Hợp đồng vừa thay đổi trạng thái, không thể chuyển phòng');
    }

    // 3. Nhả 1 chỗ ở phòng cũ
    await contractService.releaseRoomSlot(oldRoomId);
    finalTargetRoomId = targetRoom._id;
    transferInfoText = ` Bạn đã được chuyển sang Phòng ${targetBuilding.code}-${targetRoom.roomNumber}.`;
  }

  const updated = await Request.findByIdAndUpdate(
    doc._id,
    {
      $set: {
        status: nextStatus,
        targetRoomId: finalTargetRoomId,
        handlerNote,
        handledBy: actor.id,
        handledByName: actor.fullName,
        handledAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  ).lean();

  // Gửi thông báo vào chuông của sinh viên
  await notificationService
    .notifyStudent(doc.studentId, {
      type: 'request',
      title: `Phiếu ${doc.requestCode} (${TYPE_LABEL[doc.type]}) ${STATUS_LABEL[nextStatus]}`,
      content: `${doc.title}: ${STATUS_LABEL[nextStatus]}.${transferInfoText}${handlerNote ? ` Ghi chú: ${handlerNote}` : ''}`,
      refType: 'request',
      refId: doc._id,
    })
    .catch(() => {});

  const [view] = await requestViews([updated]);
  return {
    data: view,
    message: transferInfoText ? `Đã phê duyệt chuyển phòng (${doc.requestCode})` : `Đã cập nhật phiếu ${doc.requestCode}`,
  };
}

module.exports = {
  createByStudent,
  listByStudent,
  cancelByStudent,
  list,
  updateStatus,
};
