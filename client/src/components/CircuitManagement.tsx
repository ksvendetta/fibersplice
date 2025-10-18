import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Circuit, Cable, InsertCircuit } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CircuitManagementProps {
  cable: Cable;
}

export function CircuitManagement({ cable }: CircuitManagementProps) {
  const { toast } = useToast();
  const [circuitId, setCircuitId] = useState("");
  const [fiberStart, setFiberStart] = useState("");
  const [fiberEnd, setFiberEnd] = useState("");

  const { data: circuits = [], isLoading } = useQuery<Circuit[]>({
    queryKey: ["/api/circuits/cable", cable.id],
    queryFn: async () => {
      const response = await fetch(`/api/circuits/cable/${cable.id}`);
      if (!response.ok) throw new Error("Failed to fetch circuits");
      return response.json();
    },
  });

  const createCircuitMutation = useMutation({
    mutationFn: async (data: InsertCircuit) => {
      return await apiRequest("POST", "/api/circuits", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/circuits/cable", cable.id] });
      setCircuitId("");
      setFiberStart("");
      setFiberEnd("");
      toast({ title: "Circuit added successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add circuit", 
        description: error.message || "Please check your input",
        variant: "destructive" 
      });
    },
  });

  const deleteCircuitMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/circuits/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/circuits/cable", cable.id] });
      toast({ title: "Circuit deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete circuit", variant: "destructive" });
    },
  });

  const handleAddCircuit = () => {
    if (!circuitId.trim() || !fiberStart || !fiberEnd) {
      toast({
        title: "Missing fields",
        description: "Please fill in all circuit fields",
        variant: "destructive",
      });
      return;
    }

    const start = parseInt(fiberStart);
    const end = parseInt(fiberEnd);

    if (isNaN(start) || isNaN(end) || start < 1 || end > cable.fiberCount || start > end) {
      toast({
        title: "Invalid fiber range",
        description: `Fibers must be between 1 and ${cable.fiberCount}`,
        variant: "destructive",
      });
      return;
    }

    createCircuitMutation.mutate({
      cableId: cable.id,
      circuitId: circuitId.trim(),
      fiberStart: start,
      fiberEnd: end,
    });
  };

  const totalAssignedFibers = useMemo(() => {
    return circuits.reduce((sum, circuit) => {
      return sum + (circuit.fiberEnd - circuit.fiberStart + 1);
    }, 0);
  }, [circuits]);

  const validationStatus = useMemo(() => {
    return totalAssignedFibers === cable.fiberCount;
  }, [totalAssignedFibers, cable.fiberCount]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading circuits...</div>;
  }

  return (
    <Card data-testid="card-circuit-management">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg">Circuit Details</CardTitle>
        <div className="flex items-center gap-2">
          {validationStatus ? (
            <Badge variant="default" className="gap-1" data-testid="badge-validation-pass">
              <CheckCircle2 className="h-3 w-3" />
              Pass
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1" data-testid="badge-validation-fail">
              <XCircle className="h-3 w-3" />
              Fail
            </Badge>
          )}
          <span className="text-sm text-muted-foreground" data-testid="text-fiber-count">
            {totalAssignedFibers} / {cable.fiberCount} fibers
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5">
            <Label htmlFor="circuitId" className="text-xs">
              Circuit ID
            </Label>
            <Input
              id="circuitId"
              data-testid="input-circuit-id"
              value={circuitId}
              onChange={(e) => setCircuitId(e.target.value)}
              placeholder="e.g., b,1-2"
              className="text-sm"
            />
          </div>
          <div className="col-span-3">
            <Label htmlFor="fiberStart" className="text-xs">
              Fiber Start
            </Label>
            <Input
              id="fiberStart"
              data-testid="input-fiber-start"
              type="number"
              value={fiberStart}
              onChange={(e) => setFiberStart(e.target.value)}
              placeholder="1"
              min="1"
              max={cable.fiberCount}
              className="text-sm"
            />
          </div>
          <div className="col-span-3">
            <Label htmlFor="fiberEnd" className="text-xs">
              Fiber End
            </Label>
            <Input
              id="fiberEnd"
              data-testid="input-fiber-end"
              type="number"
              value={fiberEnd}
              onChange={(e) => setFiberEnd(e.target.value)}
              placeholder={cable.fiberCount.toString()}
              min="1"
              max={cable.fiberCount}
              className="text-sm"
            />
          </div>
          <div className="col-span-1 flex items-end">
            <Button
              size="icon"
              data-testid="button-add-circuit"
              onClick={handleAddCircuit}
              disabled={createCircuitMutation.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {circuits.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Circuit ID</TableHead>
                  <TableHead className="w-[45%]">Fiber Range</TableHead>
                  <TableHead className="w-[15%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {circuits.map((circuit) => (
                  <TableRow key={circuit.id} data-testid={`row-circuit-${circuit.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-circuit-id-${circuit.id}`}>
                      {circuit.circuitId}
                    </TableCell>
                    <TableCell className="font-mono text-sm" data-testid={`text-fiber-range-${circuit.id}`}>
                      {circuit.fiberStart}-{circuit.fiberEnd} ({circuit.fiberEnd - circuit.fiberStart + 1} fibers)
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-delete-circuit-${circuit.id}`}
                        onClick={() => deleteCircuitMutation.mutate(circuit.id)}
                        disabled={deleteCircuitMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {circuits.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No circuits defined. Add a circuit to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
