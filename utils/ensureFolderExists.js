async function ensureFolderExists(drive, name) {
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`,
    fields: "files(id, name)"
  });

  if (res.data.files.length > 0) return res.data.files[0].id;

  const folder = await drive.files.create({
    resource: { name, mimeType: "application/vnd.google-apps.folder" },
    fields: "id"
  });

  return folder.data.id;
}

module.exports = { ensureFolderExists };
