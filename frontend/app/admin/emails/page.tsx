'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';

interface EmailLog {
  id: number;
  userId: number;
  username: string;
  email: string;
  status: 'sent' | 'failed' | 'pending';
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

interface Generation {
  id: number;
  year: number;
  status: string;
  userCount: number;
  createdAt: string;
}

export default function AdminEmailsPage() {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedGeneration, setSelectedGeneration] = useState<number | ''>('');
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [logs, gens]: any = await Promise.all([api.getEmailLogs(), api.getGenerations()]);
      setEmailLogs(logs);
      setGenerations(gens.filter((g: Generation) => g.status === 'completed'));

      // Auto-select the latest generation
      if (gens.length > 0 && selectedGeneration === '') {
        setSelectedGeneration(gens[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmails = async () => {
    if (!selectedGeneration) {
      setError('Please select a generation first');
      return;
    }

    const gen = generations.find((g) => g.id === selectedGeneration);
    if (!gen) return;

    const confirmMessage = testMode
      ? `Send emails in TEST MODE for generation #${selectedGeneration} (${gen.year})?\n\nActually, TEST MODE means emails will NOT be sent. This is just for testing the flow.`
      : `Send emails to ${gen.userCount} users for generation #${selectedGeneration} (${gen.year})?\n\nThis will send wrapped stats links to all users. This cannot be undone!`;

    if (!confirm(confirmMessage)) return;

    setSending(true);
    setError('');
    setSuccessMessage('');
    try {
      const result: any = await api.sendEmails(selectedGeneration, undefined, testMode);

      if (result.testMode) {
        setSuccessMessage('TEST MODE: No emails were sent. Stats are ready for preview!');
      } else {
        setSuccessMessage(
          `Email sending started! Sending to ${gen.userCount} users in the background.`
        );
      }

      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-plex-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gradient">Emails</h1>
        <p className="text-gray-400 mt-1">Send wrapped stats links and view email logs</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-md p-3">
          {successMessage}
        </div>
      )}

      {/* Send Emails */}
      <Card>
        <CardHeader>
          <CardTitle>Send Wrapped Emails</CardTitle>
          <CardDescription>
            Send personalized wrapped stats links to users via email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="generation">Generation</Label>
              <select
                id="generation"
                value={selectedGeneration}
                onChange={(e) => setSelectedGeneration(parseInt(e.target.value, 10))}
                disabled={sending || generations.length === 0}
                className="flex h-10 w-full rounded-md border border-dark-700 bg-dark-800 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plex-500"
              >
                <option value="">Select a generation...</option>
                {generations.map((gen) => (
                  <option key={gen.id} value={gen.id}>
                    #{gen.id} - {gen.year} ({gen.userCount} users)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailTestMode">Mode</Label>
              <div className="flex items-center space-x-2 h-10">
                <input
                  id="emailTestMode"
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  disabled={sending}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="emailTestMode" className="cursor-pointer">
                  Test Mode (don't actually send)
                </Label>
              </div>
            </div>
          </div>

          {testMode && (
            <div className="text-sm text-plex-500 bg-plex-500/10 border border-plex-500/20 rounded-md p-3">
              Test mode enabled: Emails will NOT be sent. Use this to verify everything is ready!
            </div>
          )}

          <Button
            onClick={handleSendEmails}
            disabled={sending || !selectedGeneration || generations.length === 0}
          >
            {sending ? 'Sending...' : 'Send Emails to All Users'}
          </Button>

          {generations.length === 0 && (
            <p className="text-sm text-gray-400">
              No completed generations available. Generate wrapped stats first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Email Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {emailLogs.filter((log) => log.status === 'sent').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <span className="text-2xl">⏳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {emailLogs.filter((log) => log.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <span className="text-2xl">❌</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {emailLogs.filter((log) => log.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Email Logs</CardTitle>
          <CardDescription>History of all sent emails</CardDescription>
        </CardHeader>
        <CardContent>
          {emailLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">
                No emails sent yet. Send your first batch above!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailLogs.slice(0, 50).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.username}</TableCell>
                    <TableCell>{log.email}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(log.status)}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-400">
                      {log.sentAt ? (
                        new Date(log.sentAt).toLocaleString()
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-red-400">
                      {log.errorMessage ? (
                        <span className="truncate max-w-xs block">{log.errorMessage}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-dark-700 bg-dark-800/50">
        <CardHeader>
          <CardTitle className="text-sm">Email Sending Process</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-400 space-y-2">
          <p>
            1. Select a completed generation from the dropdown
          </p>
          <p>
            2. In test mode, the system verifies everything but doesn't send actual emails
          </p>
          <p>
            3. In live mode, personalized emails with unique links are sent to all users
          </p>
          <p>
            4. Emails are sent in the background - you can close this page
          </p>
          <p>
            5. Check the email logs table to monitor delivery status
          </p>
          <p className="pt-2 text-plex-500">
            Configure SMTP settings in your .env file before sending emails
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
