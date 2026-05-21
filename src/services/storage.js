// src/services/storage.js
import {
  STORAGE_KEY,
  createDefaultAppData,
  sanitizeAppData
} from "../data/model.js";

export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createDefaultAppData();
  }

  try {
    return sanitizeAppData(JSON.parse(raw));
  } catch {
    return createDefaultAppData();
  }
}

export function saveData(data) {
  const cleanData = sanitizeAppData(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanData));
  return cleanData;
}

export function updateData(updater) {
  const currentData = loadData();
  const updatedData = updater(currentData);
  return saveData(updatedData);
}

export function resetData() {
  const defaultData = createDefaultAppData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
  return defaultData;
}