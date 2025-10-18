import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Cable, Splice, InsertCable, InsertSplice } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CableCard } from "@/components/CableCard";
import { CableForm } from "@/components/CableForm";
import { SpliceForm } from "@/components/SpliceForm";
import { SpliceTable } from "@/components/SpliceTable";
import { CableVisualization } from "@/components/CableVisualization";
import { SpliceConnections } from "@/components/SpliceConnections";
import { Plus, Cable as CableIcon, Network, Search, Filter, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { toast } = useToast();
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null);
  const [cableDialogOpen, setCableDialogOpen] = useState(false);
  const [editingCable, setEditingCable] = useState<Cable | null>(null);
  const [spliceDialogOpen, setSpliceDialogOpen] = useState(false);
  const [editingSplice, setEditingSplice] = useState<Splice | null>(null);
  const [deletingCable, setDeletingCable] = useState<Cable | null>(null);
  const [deletingSplice, setDeletingSplice] = useState<Splice | null>(null);
  const [cableSearchTerm, setCableSearchTerm] = useState("");
  const [spliceFilter, setSpliceFilter] = useState<"all" | "completed" | "pending">("all");
  const spliceContainerRef = useRef<HTMLDivElement>(null);

  const { data: cables = [], isLoading: cablesLoading } = useQuery<Cable[]>({
    queryKey: ["/api/cables"],
  });

  const { data: splices = [], isLoading: splicesLoading } = useQuery<Splice[]>({
    queryKey: ["/api/splices"],
  });

  const createCableMutation = useMutation({
    mutationFn: async (data: InsertCable) => {
      return await apiRequest("POST", "/api/cables", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cables"] });
      setCableDialogOpen(false);
      toast({ title: "Cable created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create cable", variant: "destructive" });
    },
  });

  const updateCableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertCable }) => {
      return await apiRequest("PUT", `/api/cables/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cables"] });
      setCableDialogOpen(false);
      setEditingCable(null);
      toast({ title: "Cable updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update cable", variant: "destructive" });
    },
  });

  const deleteCableMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/cables/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/splices"] });
      setDeletingCable(null);
      toast({ title: "Cable deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete cable", variant: "destructive" });
    },
  });

  const createSpliceMutation = useMutation({
    mutationFn: async (data: InsertSplice) => {
      return await apiRequest("POST", "/api/splices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/splices"] });
      setSpliceDialogOpen(false);
      toast({ title: "Splice created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create splice", variant: "destructive" });
    },
  });

  const updateSpliceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSplice> }) => {
      return await apiRequest("PUT", `/api/splices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/splices"] });
      setSpliceDialogOpen(false);
      setEditingSplice(null);
      toast({ title: "Splice updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update splice", variant: "destructive" });
    },
  });

  const deleteSpliceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/splices/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/splices"] });
      setDeletingSplice(null);
      toast({ title: "Splice deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete splice", variant: "destructive" });
    },
  });

  const handleCableSubmit = (data: InsertCable) => {
    if (editingCable) {
      updateCableMutation.mutate({ id: editingCable.id, data });
    } else {
      createCableMutation.mutate(data);
    }
  };

  const handleSpliceSubmit = (data: InsertSplice) => {
    if (editingSplice) {
      updateSpliceMutation.mutate({ id: editingSplice.id, data });
    } else {
      createSpliceMutation.mutate(data);
    }
  };

  const handleToggleSpliceComplete = (splice: Splice) => {
    updateSpliceMutation.mutate({
      id: splice.id,
      data: { isCompleted: splice.isCompleted === 1 ? 0 : 1 },
    });
  };

  const handleExportCSV = () => {
    const csvHeaders = [
      "Splice ID",
      "Source Cable",
      "Source Ribbon",
      "Source Fibers",
      "Destination Cable",
      "Destination Ribbon",
      "Destination Fibers",
      "PON Range",
      "Status"
    ];

    const csvRows = filteredSplices.map((splice) => {
      const sourceCable = cables.find((c) => c.id === splice.sourceCableId);
      const destCable = cables.find((c) => c.id === splice.destinationCableId);
      const ponRange = splice.ponStart && splice.ponEnd 
        ? `${splice.ponStart}-${splice.ponEnd}`
        : "";
      
      return [
        splice.id,
        sourceCable?.name || "Unknown",
        splice.sourceRibbon,
        `${splice.sourceStartFiber}-${splice.sourceEndFiber}`,
        destCable?.name || "Unknown",
        splice.destinationRibbon,
        `${splice.destinationStartFiber}-${splice.destinationEndFiber}`,
        ponRange,
        splice.isCompleted === 1 ? "Completed" : "Pending"
      ];
    });

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `splice-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "CSV exported successfully" });
  };

  const filteredCables = useMemo(() => {
    if (!cableSearchTerm) return cables;
    const searchLower = cableSearchTerm.toLowerCase();
    return cables.filter(
      (cable) =>
        cable.name.toLowerCase().includes(searchLower) ||
        cable.type.toLowerCase().includes(searchLower)
    );
  }, [cables, cableSearchTerm]);

  const filteredSplices = useMemo(() => {
    if (spliceFilter === "all") return splices;
    if (spliceFilter === "completed") return splices.filter((s) => s.isCompleted === 1);
    return splices.filter((s) => s.isCompleted === 0);
  }, [splices, spliceFilter]);

  const selectedCable = cables.find((c) => c.id === selectedCableId);

  const feedCables = filteredCables.filter((c) => c.type === "Feed");
  const middleCables = filteredCables.filter((c) => c.type === "Cable");
  const distributionCables = filteredCables.filter((c) => c.type === "Distribution");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Network className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Fiber Splice Manager</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs defaultValue="input" className="w-full">
          <TabsList className="mb-6" data-testid="tabs-main">
            <TabsTrigger value="input" data-testid="tab-input-data">
              <CableIcon className="h-4 w-4 mr-2" />
              InputData
            </TabsTrigger>
            <TabsTrigger value="splice" data-testid="tab-splice">
              <Network className="h-4 w-4 mr-2" />
              Splice
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Cables</h2>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingCable(null);
                      setCableDialogOpen(true);
                    }}
                    data-testid="button-add-cable"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Cable
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search cables by name or type..."
                    value={cableSearchTerm}
                    onChange={(e) => setCableSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-cables"
                  />
                </div>

                <ScrollArea className="h-[560px] pr-4">
                  <div className="space-y-2">
                    {cablesLoading ? (
                      <div className="text-center py-12 text-muted-foreground">Loading cables...</div>
                    ) : cables.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-cables">
                        No cables yet. Add a cable to get started.
                      </div>
                    ) : filteredCables.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
                        No cables match your search.
                      </div>
                    ) : (
                      filteredCables.map((cable) => (
                        <CableCard
                          key={cable.id}
                          cable={cable}
                          isSelected={selectedCableId === cable.id}
                          onSelect={() => setSelectedCableId(cable.id)}
                          onEdit={() => {
                            setEditingCable(cable);
                            setCableDialogOpen(true);
                          }}
                          onDelete={() => setDeletingCable(cable)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {selectedCable ? `Cable: ${selectedCable.name}` : "Select a cable"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCable ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className="ml-2 font-medium">{selectedCable.type}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fiber Count:</span>
                            <span className="ml-2 font-mono font-medium">{selectedCable.fiberCount}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ribbon Size:</span>
                            <span className="ml-2 font-mono font-medium">{selectedCable.ribbonSize}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ribbons:</span>
                            <span className="ml-2 font-mono font-medium">
                              {Math.ceil(selectedCable.fiberCount / selectedCable.ribbonSize)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium mb-3">Related Splices</h3>
                          <div className="space-y-2">
                            {splices.filter(
                              (s) =>
                                s.sourceCableId === selectedCable.id ||
                                s.destinationCableId === selectedCable.id
                            ).length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No splices connected to this cable yet.
                              </p>
                            ) : (
                              <SpliceTable
                                splices={splices.filter(
                                  (s) =>
                                    s.sourceCableId === selectedCable.id ||
                                    s.destinationCableId === selectedCable.id
                                )}
                                cables={cables}
                                onEdit={(splice) => {
                                  setEditingSplice(splice);
                                  setSpliceDialogOpen(true);
                                }}
                                onDelete={(splice) => setDeletingSplice(splice)}
                                onToggleComplete={handleToggleSpliceComplete}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        Select a cable from the list to view details
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <CardTitle>Splice Connections</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-muted-foreground" />
                          <Badge
                            variant={spliceFilter === "all" ? "default" : "outline"}
                            className="cursor-pointer hover-elevate"
                            onClick={() => setSpliceFilter("all")}
                            data-testid="filter-all-splices"
                          >
                            All
                          </Badge>
                          <Badge
                            variant={spliceFilter === "completed" ? "default" : "outline"}
                            className="cursor-pointer hover-elevate"
                            onClick={() => setSpliceFilter("completed")}
                            data-testid="filter-completed-splices"
                          >
                            Completed
                          </Badge>
                          <Badge
                            variant={spliceFilter === "pending" ? "default" : "outline"}
                            className="cursor-pointer hover-elevate"
                            onClick={() => setSpliceFilter("pending")}
                            data-testid="filter-pending-splices"
                          >
                            Pending
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleExportCSV}
                          disabled={filteredSplices.length === 0}
                          data-testid="button-export-csv"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingSplice(null);
                            setSpliceDialogOpen(true);
                          }}
                          disabled={cables.length < 2}
                          data-testid="button-add-splice"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Splice
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {splicesLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading splices...</div>
                    ) : (
                      <SpliceTable
                        splices={filteredSplices}
                        cables={cables}
                        onEdit={(splice) => {
                          setEditingSplice(splice);
                          setSpliceDialogOpen(true);
                        }}
                        onDelete={(splice) => setDeletingSplice(splice)}
                        onToggleComplete={handleToggleSpliceComplete}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="splice">
            <Card>
              <CardHeader>
                <CardTitle>Splice Visualization</CardTitle>
              </CardHeader>
              <CardContent>
                {cables.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Add cables in the InputData tab to visualize splices
                  </div>
                ) : (
                  <div className="relative" ref={spliceContainerRef}>
                    <ScrollArea className="w-full">
                      <div className="flex gap-8 p-8 min-w-max">
                        {feedCables.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground">Feed</h3>
                            {feedCables.map((cable) => (
                              <CableVisualization
                                key={cable.id}
                                cable={cable}
                                splices={splices}
                                position="left"
                              />
                            ))}
                          </div>
                        )}

                        {middleCables.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground">Cable</h3>
                            {middleCables.map((cable) => (
                              <CableVisualization
                                key={cable.id}
                                cable={cable}
                                splices={splices}
                                position="middle"
                              />
                            ))}
                          </div>
                        )}

                        {distributionCables.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground">Distribution</h3>
                            {distributionCables.map((cable) => (
                              <CableVisualization
                                key={cable.id}
                                cable={cable}
                                splices={splices}
                                position="right"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <SpliceConnections
                      cables={cables}
                      splices={splices}
                      containerRef={spliceContainerRef}
                      onToggleComplete={handleToggleSpliceComplete}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={cableDialogOpen} onOpenChange={setCableDialogOpen}>
        <DialogContent data-testid="dialog-cable-form">
          <DialogHeader>
            <DialogTitle>{editingCable ? "Edit Cable" : "Add New Cable"}</DialogTitle>
          </DialogHeader>
          <CableForm
            cable={editingCable || undefined}
            onSubmit={handleCableSubmit}
            onCancel={() => {
              setCableDialogOpen(false);
              setEditingCable(null);
            }}
            isLoading={createCableMutation.isPending || updateCableMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={spliceDialogOpen} onOpenChange={setSpliceDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-splice-form">
          <DialogHeader>
            <DialogTitle>{editingSplice ? "Edit Splice" : "Add New Splice"}</DialogTitle>
          </DialogHeader>
          <SpliceForm
            cables={cables}
            splice={editingSplice || undefined}
            onSubmit={handleSpliceSubmit}
            onCancel={() => {
              setSpliceDialogOpen(false);
              setEditingSplice(null);
            }}
            isLoading={createSpliceMutation.isPending || updateSpliceMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCable} onOpenChange={() => setDeletingCable(null)}>
        <AlertDialogContent data-testid="dialog-delete-cable">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCable?.name}"? This will also delete all
              associated splices. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-cable">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCable && deleteCableMutation.mutate(deletingCable.id)}
              data-testid="button-confirm-delete-cable"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingSplice} onOpenChange={() => setDeletingSplice(null)}>
        <AlertDialogContent data-testid="dialog-delete-splice">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Splice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this splice connection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-splice">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSplice && deleteSpliceMutation.mutate(deletingSplice.id)}
              data-testid="button-confirm-delete-splice"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
