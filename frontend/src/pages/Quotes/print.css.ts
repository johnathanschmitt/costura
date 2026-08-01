/**
 * CSS de impressão do orçamento.
 *
 * O `displayPrint: 'none'` do MUI já esconde a barra de ações, mas o resto
 * precisa ser dito explicitamente: margem da folha, fundo branco e preservação
 * das cores — o Chrome descarta fundos coloridos na impressão por padrão.
 */
export const PRINT_CSS = `
  @page {
    size: A4;
    margin: 10mm;
  }
  @media print {
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
    }
    body * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
    .quote-doc {
      max-width: none !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
  }
`;
