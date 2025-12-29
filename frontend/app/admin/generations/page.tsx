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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Generation {
  id: number;
  year: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_users: number;
  processed_users?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export default function AdminGenerationsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    loadGenerations();
    // Poll for updates if there are running generations
    const interval = setInterval(() => {
      loadGenerations();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadGenerations = async () => {
    try {
      const data: any = await api.getGenerations();
      setGenerations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load generations');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWrapped = async () => {
    const confirmMessage = testMode
      ? `Generate Wrapped ${selectedYear} stats in TEST MODE?\n\nStats will be generated but NO emails will be sent. You can preview all users afterward.`
      : `Generate Wrapped ${selectedYear} stats?\n\nThis will calculate stats for all users. Make sure you're ready!`;

    if (!confirm(confirmMessage)) return;

    setGenerating(true);
    setError('');
    setSuccessMessage('');
    try {
      const result: any = await api.generateWrapped(selectedYear);
      setSuccessMessage(
        `Generation started successfully (ID: ${result.generationId}). This may take a few minutes...`
      );
      await loadGenerations();
    } catch (err: any) {
      setError(err.message || 'Failed to start generation');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
        return 'secondary';
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
        <h1 className="text-3xl font-bold text-gradient">Generations</h1>
        <p className="text-gray-400 mt-1">Manage wrapped stats generation runs</p>
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

      {/* Generate New */}
      <Card>
        <CardHeader>
          <CardTitle>Generate New Wrapped Stats</CardTitle>
          <CardDescription>
            Create wrapped statistics for all users for a specific year
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                min="2020"
                max={new Date().getFullYear()}
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                disabled={generating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testMode">Mode</Label>
              <div className="flex items-center space-x-2 h-10">
                <input
                  id="testMode"
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  disabled={generating}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="testMode" className="cursor-pointer">
                  Test Mode (don't send emails)
                </Label>
              </div>
            </div>
          </div>

          {testMode && (
            <div className="text-sm text-plex-500 bg-plex-500/10 border border-plex-500/20 rounded-md p-3">
              Test mode enabled: Stats will be generated but emails will NOT be sent. Perfect for
              testing!
            </div>
          )}

          <Button onClick={handleGenerateWrapped} disabled={generating}>
            {generating ? 'Starting Generation...' : `Generate Wrapped ${selectedYear}`}
          </Button>
        </CardContent>
      </Card>

      {/* Generations List */}
      <Card>
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
          <CardDescription>All wrapped stats generation runs</CardDescription>
        </CardHeader>
        <CardContent>
          {generations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">
                No generations yet. Create your first wrapped stats above!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generations.map((gen) => (
                  <TableRow key={gen.id}>
                    <TableCell className="font-medium">#{gen.id}</TableCell>
                    <TableCell>{gen.year}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(gen.status)}>
                        {gen.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{gen.total_users}</TableCell>
                    <TableCell>
                      {gen.processed_users !== undefined ? (
                        <span className="text-sm">
                          {gen.processed_users}/{gen.total_users}
                          {gen.status === 'running' && (
                            <span className="text-gray-400 ml-2">
                              ({Math.round((gen.processed_users / gen.total_users) * 100)}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-400">
                      {new Date(gen.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-gray-400">
                      {gen.completed_at ? (
                        new Date(gen.completed_at).toLocaleString()
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
          <CardTitle className="text-sm">Generation Process</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-400 space-y-2">
          <p>
            1. Fetches all users from Tautulli
          </p>
          <p>
            2. For each user, calculates comprehensive viewing statistics for the selected year
          </p>
          <p>
            3. Generates secure access tokens for each user
          </p>
          <p>
            4. Stores all data in the database
          </p>
          <p>
            5. In test mode, emails are NOT sent - preview users from the Users page
          </p>
          <p className="pt-2 text-plex-500">
            Large libraries may take several minutes to process. The page will auto-refresh.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
