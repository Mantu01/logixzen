export async function saveTextFile(
  defaultPath: string,
  content: string,
  filters: Array<{ name: string; extensions: string[] }>,
): Promise<boolean> {
  const bridge = window.logixzen;
  if (bridge === undefined) {
    return false;
  }
  const filePath = await bridge.dialog.saveFile({ defaultPath, filters });
  if (filePath === null) {
    return false;
  }
  await bridge.files.writeText(filePath, content);
  return true;
}
