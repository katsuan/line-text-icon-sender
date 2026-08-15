const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DRIVE_FOLDER_ID_KEY = 'DRIVE_FOLDER_ID';
const FLEX_HISTORY_FOLDER_NAME = '_flex_sent';
const NO_HISTORY_FOLDER_NAME = '_no_history';
const NO_HISTORY_KEEP_COUNT = 3;

function doGet(e) {
  try {
    const params = getRequestParameters_(e);
    const action = params.action || 'status';

    if (action === 'history') {
      const driveFolderId = getRequiredScriptProperty_(DRIVE_FOLDER_ID_KEY);
      const rootFolder = DriveApp.getFolderById(driveFolderId);
      const userKey = sanitizeDriveName_(params.userKey || 'local_debug');
      const limit = Math.max(1, Math.min(Number(params.limit || 12), 30));
      const userFolder = getOrCreateChildFolder_(rootFolder, userKey);
      cleanupNoHistoryFolder_(userFolder);
      return jsonResponse({
        ok: true,
        action: 'history',
        userKey: userKey,
        folderName: userFolder.getName(),
        items: listHistory_(userFolder, limit),
      });
    }

    return jsonResponse({
      ok: true,
      action: 'status',
      message: 'TextIconSender GAS is running.',
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || String(error),
    });
  }
}

function doPost(e) {
  try {
    const driveFolderId = getRequiredScriptProperty_(DRIVE_FOLDER_ID_KEY);
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('POST データがありません。');
    }

    const payload = JSON.parse(e.postData.contents);
    const fileName = sanitizeFileName(payload.fileName || 'texticon_sender.png');
    const mimeType = payload.mimeType || 'image/png';
    const imageBase64 = payload.imageBase64 || '';
    const userKey = sanitizeDriveName_(payload.userKey || 'local_debug');
    const assetKey = String(payload.assetKey || fileName);
    const keepHistory = payload.keepHistory !== false;
    const width = Math.max(1, Math.round(Number(payload.width) || 256));
    const height = Math.max(1, Math.round(Number(payload.height) || 256));

    if (payload.action === 'delete') {
      const rootFolder = DriveApp.getFolderById(driveFolderId);
      const userFolder = getOrCreateChildFolder_(rootFolder, userKey);
      const file = findFileByIdRecursive_(userFolder, String(payload.fileId || ''));
      if (!file) {
        throw new Error('削除対象の画像が見つかりません。');
      }
      const metadata = parseMetadata_(file.getDescription());
      if (metadata.flexLocked === true) {
        throw new Error('Flex送信済みの画像は削除できません。');
      }
      file.setTrashed(true);
      return jsonResponse({
        ok: true,
        action: 'delete',
        fileId: file.getId(),
        userKey: userKey,
      });
    }

    if (payload.action === 'markFlex') {
      const rootFolder = DriveApp.getFolderById(driveFolderId);
      const userFolder = getOrCreateChildFolder_(rootFolder, userKey);
      const file = findFileByIdRecursive_(userFolder, String(payload.fileId || ''));
      if (!file) {
        throw new Error('Flex送信用の画像が見つかりません。');
      }
      const metadata = parseMetadata_(file.getDescription());
      metadata.keepHistory = true;
      metadata.flexLocked = true;
      metadata.sentMode = 'flex';
      metadata.flexSentAt = new Date().toISOString();
      updateFileMetadata_(file, metadata);
      const flexFolder = getOrCreateChildFolder_(userFolder, FLEX_HISTORY_FOLDER_NAME);
      file.moveTo(flexFolder);
      return jsonResponse({
        ok: true,
        action: 'markFlex',
        fileId: file.getId(),
        folderName: flexFolder.getName(),
        userKey: userKey,
      });
    }

    if (!imageBase64) {
      throw new Error('imageBase64 がありません。');
    }

    const rootFolder = DriveApp.getFolderById(driveFolderId);
    const userFolder = getOrCreateChildFolder_(rootFolder, userKey);
    const storedFileName = buildStoredFileName_(assetKey, mimeType);
    const existingFile = findExistingUploadFile_(userFolder, storedFileName);
    const file = existingFile || createDriveFile_(userFolder, imageBase64, mimeType, storedFileName);
    updateFileMetadata_(file, {
      sourceFileName: fileName,
      text: payload.text || '',
      savedAt: new Date().toISOString(),
      keepHistory: keepHistory,
      width: width,
      height: height,
    });
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    if (keepHistory) {
      file.moveTo(userFolder);
    } else {
      const hiddenFolder = getOrCreateChildFolder_(userFolder, NO_HISTORY_FOLDER_NAME);
      file.moveTo(hiddenFolder);
    }

    const fileId = file.getId();
    const publicUrl = buildDrivePublicUrl(fileId);

    return jsonResponse({
      ok: true,
      action: 'save',
      fileId: fileId,
      fileName: file.getName(),
      sourceFileName: fileName,
      text: payload.text || '',
      folderName: userFolder.getName(),
      userKey: userKey,
      reused: Boolean(existingFile),
      originalContentUrl: publicUrl,
      previewImageUrl: buildDriveThumbnailUrl(fileId),
      webViewLink: file.getUrl(),
      createdAt: new Date().toISOString(),
      width: width,
      height: height,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || String(error),
    });
  }
}

function createDriveFile_(folder, imageBase64, mimeType, storedFileName) {
  const bytes = Utilities.base64Decode(imageBase64);
  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('ファイルサイズが大きすぎます。');
  }

  const blob = Utilities.newBlob(bytes, mimeType, storedFileName);
  return folder.createFile(blob);
}

function getOrCreateChildFolder_(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

function findFileByName_(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  return files.hasNext() ? files.next() : null;
}

function findExistingUploadFile_(userFolder, storedFileName) {
  const direct = findFileByName_(userFolder, storedFileName);
  if (direct) {
    return direct;
  }
  const hiddenFolders = userFolder.getFoldersByName(NO_HISTORY_FOLDER_NAME);
  if (hiddenFolders.hasNext()) {
    return findFileByName_(hiddenFolders.next(), storedFileName);
  }
  return null;
}

function cleanupNoHistoryFolder_(userFolder) {
  const hiddenFolders = userFolder.getFoldersByName(NO_HISTORY_FOLDER_NAME);
  if (!hiddenFolders.hasNext()) {
    return;
  }
  const hiddenFolder = hiddenFolders.next();
  const files = [];
  const iterator = hiddenFolder.getFiles();
  while (iterator.hasNext()) {
    files.push(iterator.next());
  }
  if (files.length <= NO_HISTORY_KEEP_COUNT) {
    return;
  }
  files.sort(function(a, b) {
    return b.getDateCreated().getTime() - a.getDateCreated().getTime();
  });
  files.slice(NO_HISTORY_KEEP_COUNT).forEach(function(file) {
    file.setTrashed(true);
  });
}

function findFileByIdRecursive_(folder, fileId) {
  if (!fileId) {
    return null;
  }
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getId() === fileId) {
      return file;
    }
  }
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const found = findFileByIdRecursive_(folders.next(), fileId);
    if (found) {
      return found;
    }
  }
  return null;
}

function buildStoredFileName_(assetKey, mimeType) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, assetKey, Utilities.Charset.UTF_8);
  const hex = digest.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
  const ext = mimeType === 'image/png' ? '.png' : '';
  return hex + ext;
}

function listHistory_(folder, limit) {
  const items = [];
  collectHistoryItems_(folder, items);

  items.sort(function(a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return items.slice(0, limit);
}

function collectHistoryItems_(folder, items) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const metadata = parseMetadata_(file.getDescription());
    if (metadata.keepHistory === false) {
      continue;
    }
    items.push({
      fileId: file.getId(),
      fileName: file.getName(),
      sourceFileName: metadata.sourceFileName || file.getName(),
      folderName: folder.getName(),
      originalContentUrl: buildDrivePublicUrl(file.getId()),
      previewImageUrl: buildDriveThumbnailUrl(file.getId()),
      webViewLink: file.getUrl(),
      createdAt: file.getDateCreated().toISOString(),
      text: metadata.text || '',
      flexLocked: metadata.flexLocked === true,
      sentMode: metadata.sentMode || '',
      width: Math.max(1, Math.round(Number(metadata.width) || 256)),
      height: Math.max(1, Math.round(Number(metadata.height) || 256)),
    });
  }

  const folders = folder.getFolders();
  while (folders.hasNext()) {
    collectHistoryItems_(folders.next(), items);
  }
}

function parseMetadata_(description) {
  if (!description) {
    return {};
  }
  try {
    return JSON.parse(description);
  } catch (error) {
    return {};
  }
}

function updateFileMetadata_(file, metadata) {
  file.setDescription(JSON.stringify(metadata));
}

function getRequestParameters_(e) {
  return e && e.parameter ? e.parameter : {};
}

function getRequiredScriptProperty_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error(key + ' が Script Properties に未設定です。');
  }
  return value;
}

function buildDrivePublicUrl(fileId) {
  return 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(fileId);
}

function buildDriveThumbnailUrl(fileId) {
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w400';
}

function sanitizeFileName(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function sanitizeDriveName_(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'local_debug';
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
