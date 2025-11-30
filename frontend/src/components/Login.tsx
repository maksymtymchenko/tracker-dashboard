import React, { useState } from 'react';

interface Props {
  onSubmit(username: string, password: string): Promise<void>;
}

export function Login({ onSubmit }: Props): JSX.Element {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      await onSubmit(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <form onSubmit={handle} className="w-full max-w-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-3">
        <div className="text-lg font-semibold">Sign in</div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Username</label>
          <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Password</label>
          <input type="password" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button disabled={loading} className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white">{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}


