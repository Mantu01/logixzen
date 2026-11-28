function fallbackDownload(defaultPath: string, content: string): boolean {
  if (typeof document === "undefined") return false;
  const fileName = defaultPath.split(/[\\/]/).pop() || "query.sql";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function saveTextFileAs(
  defaultPath: string,
  content: string,
  filters: Array<{ name: string; extensions: string[] }>,
): Promise<string | null> {
  const bridge = window.logixzen;
  if (bridge === undefined) {
    return fallbackDownload(defaultPath, content) ? defaultPath : null;
  }
  const filePath = await bridge.dialog.saveFile({ defaultPath, filters });
  if (filePath === null) {
    return null;
  }
  await bridge.files.writeText(filePath, content);
  return filePath;
}

export async function saveTextFile(
  defaultPath: string,
  content: string,
  filters: Array<{ name: string; extensions: string[] }>,
): Promise<boolean> {
  const savedPath = await saveTextFileAs(defaultPath, content, filters);
  return savedPath !== null;
}
