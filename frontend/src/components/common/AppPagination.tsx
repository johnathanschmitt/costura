import { Box, Pagination, Typography } from '@mui/material';

interface Props {
  total: number;
  page: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function AppPagination({ total, page, limit, onChange }: Props) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, flexWrap: 'wrap', gap: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {from}–{to} de {total} registros
      </Typography>
      <Pagination
        count={pages}
        page={page}
        onChange={(_, v) => onChange(v)}
        size="small"
        color="primary"
        siblingCount={1}
      />
    </Box>
  );
}
