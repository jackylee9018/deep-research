declare module 'html-to-docx' {
  function HTMLtoDOCX(
    html: string,
    headerHTML: string | null,
    options?: Record<string, unknown>,
  ): Promise<Buffer | ArrayBuffer | Blob | Uint8Array>;

  export default HTMLtoDOCX;
}
