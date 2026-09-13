/**
 * Script kiểm tra kết nối tới MongoDB Atlas
 * Kiểm tra kết nối, ping, thống kê CSDL và quyền đọc/ghi.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  console.log('--------------------------------------------------');
  console.log('[TEST-DB] Bắt đầu kiểm tra kết nối MongoDB Atlas...');
  console.log(`[TEST-DB] URI: ${uri.replace(/:([^:@]+)@/, ':****@')}`);

  if (!uri) {
    console.error('[TEST-DB] ❌ Lỗi: Chưa cấu hình MONGODB_URI trong .env');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });

    const latency = Date.now() - startTime;
    const adminDb = mongoose.connection.db.admin();
    const pingResult = await adminDb.ping();

    console.log(`[TEST-DB] ✅ Kết nối thành công tới MongoDB Atlas! (Thời gian: ${latency}ms)`);
    console.log(`[TEST-DB] Database name: ${mongoose.connection.name}`);
    console.log(`[TEST-DB] Host: ${mongoose.connection.host}`);
    console.log(`[TEST-DB] Ping status:`, pingResult);

    // Kiểm tra quyền ghi và đọc (Write/Read Check)
    const testCollection = mongoose.connection.db.collection('_connection_test');
    const testDoc = { test: true, timestamp: new Date() };
    await testCollection.insertOne(testDoc);
    console.log('[TEST-DB] ✅ Kiểm tra ghi dữ liệu (Write): Thành công!');

    const readDoc = await testCollection.findOne({ _id: testDoc._id });
    console.log('[TEST-DB] ✅ Kiểm tra đọc dữ liệu (Read): Thành công!', readDoc ? 'OK' : 'Lỗi');

    // Dọn dẹp bản ghi kiểm tra
    await testCollection.deleteOne({ _id: testDoc._id });
    console.log('[TEST-DB] ✅ Dọn dẹp dữ liệu kiểm tra: Hoàn tất!');
    console.log('--------------------------------------------------');
    console.log('[TEST-DB] 🎉 CƠ SỞ DỮ LIỆU SẴN SÀNG CHO DỰ ÁN DMS-KTX!');
    console.log('--------------------------------------------------');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('--------------------------------------------------');
    console.error('[TEST-DB] ❌ KẾT NỐI THẤT BẠI!');
    console.error('[TEST-DB] Chi tiết lỗi:', error.message);
    if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('[TEST-DB] 👉 Nguyên nhân: Sai Username hoặc Password của Database User.');
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('queryTxt ETIMEOUT') || error.message.includes('Could not connect to any servers')) {
      console.error('[TEST-DB] 👉 Nguyên nhân: Chưa cấu hình Network Access (0.0.0.0/0) trên Atlas hoặc mạng bị chặn DNS SRV.');
    }
    console.error('--------------------------------------------------');
    process.exit(1);
  }
}

testConnection();
