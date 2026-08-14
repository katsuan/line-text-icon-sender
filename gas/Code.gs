const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DRIVE_FOLDER_ID_KEY = 'DRIVE_FOLDER_ID';

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

    if (!imageBase64) {
      throw new Error('imageBase64 がありません。');
    }

    const rootFolder = DriveApp.getFolderById(driveFolderId);
    const userFolder = getOrCreateChildFolder_(rootFolder, userKey);
    const storedFileName = buildStoredFileName_(assetKey, mimeType);
    const existingFile = findFileByName_(userFolder, storedFileName);
    const file = existingFile || createDriveFile_(userFolder, imageBase64, mimeType, storedFileName, fileName, payload);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

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
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || String(error),
    });
  }
}

function createDriveFile_(folder, imageBase64, mimeType, storedFileName, originalFileName, payload) {
  const bytes = Utilities.base64Decode(imageBase64);
  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('ファイルサイズが大きすぎます。');
  }

  const blob = Utilities.newBlob(bytes, mimeType, storedFileName);
  const file = folder.createFile(blob);
  file.setDescription(JSON.stringify({
    sourceFileName: originalFileName,
    text: payload.text || '',
    savedAt: new Date().toISOString(),
  }));
  return file;
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
  const files = folder.getFiles();
  const items = [];
  while (files.hasNext()) {
    const file = files.next();
    const metadata = parseMetadata_(file.getDescription());
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
    });
  }

  items.sort(function(a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return items.slice(0, limit);
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
