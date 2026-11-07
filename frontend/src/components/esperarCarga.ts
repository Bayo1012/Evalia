/** La operación y el tiempo mínimo corren juntos; también preserva los errores. */
export async function esperarCarga<T>(operacion: Promise<T>, minimoMs = 3000): Promise<T> {
  const pausa = new Promise<void>(resolve => setTimeout(resolve, minimoMs));
  const [resultado] = await Promise.allSettled([operacion, pausa] as const);
  if (resultado.status === 'rejected') throw resultado.reason;
  return resultado.value;
}
