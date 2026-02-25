async function bootstrap(): Promise<void> {
  const engine = (process.env.QUEUE_ENGINE ?? 'bullmq').toLowerCase();

  if (engine === 'rabbitmq') {
    await import('./index');
    return;
  }

  await import('./bullmq-worker');
}

void bootstrap();
