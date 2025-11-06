import axios from "axios";
import fs from "fs";

// === 🔑 НАСТРОЙКИ ===
const MAIN_BIN_ID = "6905c636ae596e708f3c09a8";       // <- сюда вставь свой основной BIN ID
const BACKUP_BIN_ID = "69063397ae596e708f3ce0dd";     // <- сюда вставь резервный BIN ID
const MASTER_KEY = "$2a$10$J24VfFSehaO.P78eeSB/feH0/x9TKke3QBNn5eaCyqzwEnwv/w4sC";               // <- сюда вставь мастер-ключ JSONBin

// === 🔗 ССЫЛКИ НА API JSONBin ===
const MAIN_BIN_URL = `https://api.jsonbin.io/v3/b/${MAIN_BIN_ID}/latest`;
const BACKUP_BIN_URL = `https://api.jsonbin.io/v3/b/${BACKUP_BIN_ID}`;

async function backupJsonBin() {
  console.log("🚀 Запуск резервного копирования JSONBin...");
  try {
    // 1️⃣ Получаем данные из основного Bin
    const response = await axios.get(MAIN_BIN_URL, {
      headers: { "X-Master-Key": MASTER_KEY },
    });
    const data = response.data.record;
        // 3️⃣ Отправляем в резервный Bin
    await axios.put(BACKUP_BIN_URL, data, {
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": MASTER_KEY,
      },
    });
    console.log("✅ Данные успешно сохранены в резервный JSONBin");

  } catch (err) {
    console.error("❌ Ошибка при бэкапе:", err.response?.data || err.message);
  }
}

backupJsonBin();
