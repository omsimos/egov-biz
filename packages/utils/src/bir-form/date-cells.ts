type DateField = {
  maxWidth: number;
  x: number;
};

export type DateCell = DateField & {
  text: string;
};

export function normalizedDate(value: string | undefined) {
  const raw = value?.trim() ?? "";
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  return isoDate ? `${isoDate[2]}/${isoDate[3]}/${isoDate[1]}` : raw;
}

export function dateCellLayout(value: string | undefined, field: DateField): DateCell[] {
  const normalized = normalizedDate(value);
  if (!normalized) return [];

  const formattedDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  if (!formattedDate) return [{ ...field, text: normalized }];

  const digits = `${formattedDate[1]}${formattedDate[2]}${formattedDate[3]}`;
  const cellWidth = field.maxWidth / digits.length;
  return [...digits].map((text, index) => ({
    maxWidth: cellWidth,
    text,
    x: field.x + cellWidth * index,
  }));
}
