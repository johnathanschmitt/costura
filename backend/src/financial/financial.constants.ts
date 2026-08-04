/**
 * Categoria usada quando quem cria a conta a receber não informa nenhuma —
 * inclusive nos caminhos automáticos (aprovação de orçamento e entrega de OS).
 * Existe na lista padrão de categorias de receita.
 *
 * Fica em arquivo próprio porque orçamentos e ordens de serviço também criam
 * contas a receber e não devem importar o service do financeiro por causa de
 * uma string.
 */
export const DEFAULT_INCOME_CATEGORY = 'Costura';
