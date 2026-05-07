import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const wb = XLSX.utils.book_new();

const headers = ['Категория', 'Название', 'Описание', 'Остаток', 'Цена розничная'];

const sampleData = [
  ['Консервы', 'Тушёнка говяжья "Советская" 525г', 'Натуральная говяжья тушёнка высшего сорта', 100, 350],
  ['Консервы', 'Тушёнка свиная 525г', 'Натуральная свиная тушёнка. ГОСТ.', 80, 320],
  ['Крупы', 'Гречка "Алтайская" 800г', 'Гречневая крупа ядрица высшего сорта', 150, 120],
  ['Напитки', 'Чай чёрный "Принцесса Нури" 100г', 'Качественный чёрный байховый чай', 200, 85],
  ['Сладости', 'Сгущёнка "Рогачёв" 380г', 'Сгущённое молоко с сахаром. Беларусь.', 120, 120],
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

ws['!cols'] = [
  { wch: 15 },
  { wch: 40 },
  { wch: 50 },
  { wch: 10 },
  { wch: 15 },
];

XLSX.utils.book_append_sheet(wb, ws, 'Товары');

const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync('public/import-template.xlsx', buffer);

console.log('✅ Шаблон создан: public/import-template.xlsx');
