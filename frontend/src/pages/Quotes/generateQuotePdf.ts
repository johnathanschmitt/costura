/**
 * Gera o PDF do orçamento a partir do próprio documento HTML já renderizado,
 * para o arquivo sair idêntico ao que aparece na tela e na impressão.
 *
 * As bibliotecas entram por import dinâmico: só são baixadas quando alguém
 * realmente gera um PDF, sem pesar no carregamento do sistema.
 */

/** Largura de uma folha A4 em pixels a 96 dpi — a base do recorte. */
const A4_WIDTH_PX = 794;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export async function generateQuotePdf(element: HTMLElement, fileName: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    // Escala 2 mantém o texto nítido na impressão sem inflar demais o arquivo.
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    windowWidth: A4_WIDTH_PX,
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const imgHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;

  const image = canvas.toDataURL('image/jpeg', 0.92);

  if (imgHeightMm <= A4_HEIGHT_MM) {
    pdf.addImage(image, 'JPEG', 0, 0, A4_WIDTH_MM, imgHeightMm);
  } else {
    // Documento mais alto que a folha: fatia em páginas deslocando a imagem.
    let remaining = imgHeightMm;
    let offset = 0;
    while (remaining > 0) {
      pdf.addImage(image, 'JPEG', 0, -offset, A4_WIDTH_MM, imgHeightMm);
      remaining -= A4_HEIGHT_MM;
      offset += A4_HEIGHT_MM;
      if (remaining > 0) pdf.addPage();
    }
  }

  const blob = pdf.output('blob');
  pdf.save(fileName);
  return blob;
}

export const quoteFileName = (number: string, customer?: string) =>
  ['Orcamento', number, customer?.split(' ')[0]]
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]/g, '') + '.pdf';
