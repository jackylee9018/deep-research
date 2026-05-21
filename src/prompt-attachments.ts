export type PromptAttachment = {
  name: string;
  text: string;
};

export function formatAttachmentContext(
  attachments: PromptAttachment[],
): string {
  if (!attachments.length) {
    return '';
  }

  return attachments
    .map(
      attachment =>
        `### 附件：${attachment.name}\n${attachment.text.trim()}`,
    )
    .join('\n\n');
}

export function buildPromptWithAttachments(
  prompt: string,
  attachments?: PromptAttachment[],
): string {
  const context = formatAttachmentContext(attachments ?? []);
  if (!context) {
    return prompt;
  }

  return `${prompt.trim()}\n\n---\n參考附件內容：\n${context}`;
}
