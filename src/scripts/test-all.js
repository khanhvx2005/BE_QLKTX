/**
 * Chạy toàn bộ các bộ test tự động của Backend theo thứ tự từ Auth -> Phase 7.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const testFiles = [
  'test-auth-api.js',
  'test-phase2-api.js',
  'test-v12-api.js',
  'test-v12-integration.js',
];

console.log('====================================================');
console.log('🚀 BẮT ĐẦU CHẠY TOÀN BỘ BỘ TEST BACKEND DMS KTX');
console.log('====================================================\n');

let allPassed = true;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  console.log(`\n▶ ĐANG CHẠY: ${file}...`);
  const result = spawnSync('node', [filePath], { stdio: 'inherit', env: process.env });

  if (result.status !== 0) {
    console.error(`❌ Test thất bại ở file: ${file}`);
    allPassed = false;
    break;
  }
}

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 TẤT CẢ 7 BỘ TEST ĐỀU VƯỢT QUA 100%! BACKEND HOÀN HẢO!');
} else {
  console.log('💥 CÓ LỖI XẢY RA TRONG QUÁ TRÌNH TEST!');
  process.exit(1);
}
console.log('====================================================\n');
