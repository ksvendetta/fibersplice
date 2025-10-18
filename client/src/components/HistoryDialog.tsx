import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Save } from "@shared/schema";

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const { toast } = useToast();

  const { data: saves, isLoading } = useQuery<Save[]>({
    queryKey: ["/api/saves"],
    enabled: open,
  });

  const loadSaveMutation = useMutation({
    mutationFn: async (saveId: string) => {
      return await apiRequest("POST", `/api/saves/${saveId}/load`, undefined);
    },
    onSuccess: async () => {
      // Invalidate and refetch all cables and circuits queries
      await queryClient.invalidateQueries({ queryKey: ["/api/cables"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/circuits"] });
      
      toast({
        title: "Success",
        description: "Project loaded successfully",
      });
      
      // Close dialog after refetch completes
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load project",
        variant: "destructive",
      });
    },
  });

  const handleLoadSave = (saveId: string) => {
    loadSaveMutation.mutate(saveId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-history">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Project History
          </DialogTitle>
          <DialogDescription>
            Select a saved project to load. Maximum 50 saves are kept.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : saves && saves.length > 0 ? (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saves.map((save) => (
                  <TableRow key={save.id} data-testid={`row-save-${save.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-save-name-${save.id}`}>
                      {save.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadSave(save.id)}
                        disabled={loadSaveMutation.isPending}
                        data-testid={`button-load-save-${save.id}`}
                      >
                        {loadSaveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Load"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-saves">
            No saved projects found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
