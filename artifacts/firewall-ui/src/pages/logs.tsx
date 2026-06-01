import React, { useState } from "react";
import { format } from "date-fns";
import { useGetLogs } from "@workspace/api-client-react";
import { Shield, ShieldAlert, Search, Filter, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { LogEntry } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Logs() {
  const [page, setPage] = useState(0);
  const limit = 15;
  const offset = page * limit;
  
  const { data, isLoading } = useGetLogs(
    { limit, offset }, 
    { query: { keepPreviousData: true } as any }
  );

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Log History</h2>
          <p className="text-muted-foreground">Review past analyses and injection attempts.</p>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[100px]">Verdict</TableHead>
                <TableHead>Prompt Snippet</TableHead>
                <TableHead className="w-[150px]">Risk Score</TableHead>
                <TableHead className="w-[150px]">Attack Type</TableHead>
                <TableHead className="w-[180px] text-right">Timestamp</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && logs.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="border-border hover:bg-muted/50 cursor-default group">
                    <TableCell>
                      {log.verdict === "BLOCK" ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1 w-fit font-mono tracking-wider">
                          <ShieldAlert className="h-3 w-3" />
                          BLOCK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 flex items-center gap-1 w-fit font-mono tracking-wider">
                          <Shield className="h-3 w-3" />
                          ALLOW
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[300px] truncate text-muted-foreground">
                      {log.prompt}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs ${log.riskScore > 70 ? 'text-destructive font-bold' : ''}`}>
                          {log.riskScore}%
                        </span>
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${log.riskScore > 70 ? 'bg-destructive' : 'bg-success'}`} 
                            style={{ width: `${log.riskScore}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.attackType ? (
                        <span className="text-xs uppercase tracking-wide text-foreground/80">{log.attackType}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground font-mono">
                      {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <LogDetailDialog log={log} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground font-mono">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
            >
              Previous
            </Button>
            <div className="text-sm font-mono text-muted-foreground px-2">
              {page + 1} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogDetailDialog({ log }: { log: LogEntry }) {
  const isBlock = log.verdict === "BLOCK";
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] border-border bg-card">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {isBlock ? (
                <ShieldAlert className="h-5 w-5 text-destructive" />
              ) : (
                <Shield className="h-5 w-5 text-success" />
              )}
              Analysis Detail
            </DialogTitle>
            <Badge variant={isBlock ? "destructive" : "default"} className={isBlock ? "bg-destructive text-destructive-foreground hover:bg-destructive" : "bg-success text-success-foreground hover:bg-success"}>
              {log.verdict}
            </Badge>
          </div>
          <DialogDescription className="font-mono text-xs">
            ID: {log.id} • {format(new Date(log.createdAt), "PP pp")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original Prompt</h4>
            <div className="bg-background rounded-md p-4 text-sm font-mono border border-border whitespace-pre-wrap max-h-[200px] overflow-y-auto">
              {log.prompt}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">Risk Score</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xl ${log.riskScore > 70 ? 'text-destructive font-bold' : ''}`}>
                  {log.riskScore}%
                </span>
                <Progress value={log.riskScore} className="h-2 w-24" indicatorClassName={isBlock ? "bg-destructive" : "bg-success"} />
              </div>
            </div>
            
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">Attack Type</span>
              <p className="font-mono text-sm">
                {log.attackType || "None detected"}
              </p>
            </div>
            
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">ML Confidence</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{log.mlConfidence}%</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">Hybrid Model Match</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{log.hybridProbability}%</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Analysis Explanation</h4>
            <p className="text-sm text-muted-foreground">
              {log.explanation}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
