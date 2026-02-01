export function formatMessage(text: string) {
  // Split by double line breaks
  const blocks = text.split(/\n\s*\n/);

  return blocks.map((block, i) => {
    const isHeader =
      block.length < 80 &&
      !block.includes(".") &&
      !block.includes(",");

    return {
      id: i,
      type: isHeader ? "header" : "paragraph",
      content: block.trim(),
    };
  });
}
