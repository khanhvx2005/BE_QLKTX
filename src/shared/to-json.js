/**
 * toJSON chung cho mọi model: trả `id` (chuỗi), bỏ `_id`, `__v` — API.md §1.3.
 */
const toJSON = {
  virtuals: false,
  transform(doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
};

module.exports = toJSON;
