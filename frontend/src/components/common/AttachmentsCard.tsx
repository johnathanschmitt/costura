import { useRef } from 'react';
import {
  Box, Typography, IconButton, List, ListItem, ListItemText,
  ListItemIcon, CircularProgress, Tooltip, Divider, Button,
  LinearProgress,
} from '@mui/material';
import { AttachFile, Delete, Image, PictureAsPdf, InsertDriveFile, Download } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useToast } from '../../store/toast.store';

interface Props {
  entityType: 'customer' | 'workOrder' | 'quote' | 'accountPayable';
  entityId: string;
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image fontSize="small" color="primary" />;
  if (mime === 'application/pdf') return <PictureAsPdf fontSize="small" color="error" />;
  return <InsertDriveFile fontSize="small" color="action" />;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AttachmentsCard({ entityType, entityId }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const qKey = ['attachments', entityType, entityId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => api.get('/attachments', { params: { entityType, entityId } }).then(r => r.data),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/attachments/upload?entityType=${entityType}&entityId=${entityId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast('Arquivo enviado'); },
    onError: () => toast('Erro ao enviar arquivo', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/attachments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast('Anexo removido'); },
    onError: () => toast('Erro ao remover anexo', 'error'),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = '';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Anexos ({(attachments as any[]).length})
        </Typography>
        <Button
          size="small"
          startIcon={<AttachFile fontSize="small" />}
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? 'Enviando…' : 'Anexar'}
        </Button>
        <input ref={inputRef} type="file" hidden onChange={handleFile} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
      </Box>

      {upload.isPending && <LinearProgress sx={{ mb: 1 }} />}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
      ) : (attachments as any[]).length === 0 ? (
        <Typography variant="caption" color="text.disabled">Nenhum anexo</Typography>
      ) : (
        <List dense disablePadding>
          {(attachments as any[]).map((a: any, i: number) => (
            <Box key={a.id}>
              {i > 0 && <Divider />}
              <ListItem
                disablePadding
                secondaryAction={
                  <Box sx={{ display: 'flex' }}>
                    <Tooltip title="Baixar">
                      <IconButton size="small" href={a.url} target="_blank" rel="noopener">
                        <Download fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remover">
                      <IconButton size="small" color="error" onClick={() => remove.mutate(a.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{fileIcon(a.mimeType)}</ListItemIcon>
                <ListItemText
                  primary={a.originalName}
                  secondary={`${fmtSize(a.size)} · ${dayjs(a.createdAt).format('DD/MM/YYYY HH:mm')}`}
                  primaryTypographyProps={{ variant: 'body2', noWrap: true, maxWidth: 220 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            </Box>
          ))}
        </List>
      )}
    </Box>
  );
}
