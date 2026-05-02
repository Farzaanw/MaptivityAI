const configuredApiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL as string | undefined;

export function getApiBaseUrl(): string {
  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl.replace(/\/$/, '');
  }

  return (import.meta as any).env.DEV ? 'http://localhost:5050' : '';
}
