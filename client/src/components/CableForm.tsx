import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCableSchema, type InsertCable, type Cable, cableTypes } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scan } from "lucide-react";
import { OcrDialog } from "./OcrDialog";
import { normalizeCircuitId } from "@/lib/circuitIdUtils";

interface CableFormProps {
  cable?: Cable;
  onSubmit: (data: InsertCable) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CableForm({ cable, onSubmit, onCancel, isLoading }: CableFormProps) {
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  
  const form = useForm<InsertCable>({
    resolver: zodResolver(insertCableSchema),
    defaultValues: cable ? {
      name: cable.name,
      fiberCount: cable.fiberCount,
      type: cable.type as "Feed" | "Distribution",
    } : {
      name: "",
      fiberCount: 24,
      type: "Feed",
      circuitIds: [],
    },
  });
  
  // Custom submit handler that normalizes circuit IDs
  const handleFormSubmit = (data: InsertCable) => {
    // Normalize circuit IDs if they exist
    if (data.circuitIds && data.circuitIds.length > 0) {
      data.circuitIds = data.circuitIds.map(id => normalizeCircuitId(id.trim()));
    }
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cable Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Cable2, Feed1, Distribution-24"
                  {...field}
                  data-testid="input-cable-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cable Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-cable-type">
                    <SelectValue placeholder="Select cable type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cableTypes.map((type) => (
                    <SelectItem key={type} value={type} data-testid={`option-cable-type-${type}`}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fiberCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fiber Count</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="e.g., 24, 48, 72"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  data-testid="input-fiber-count"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!cable && (
          <FormField
            control={form.control}
            name="circuitIds"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Circuit IDs (Optional)</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOcrDialogOpen(true)}
                    title="Extract text from image (OCR)"
                    data-testid="button-open-cable-ocr"
                  >
                    <Scan className="h-4 w-4 mr-2" />
                    Scan Image
                  </Button>
                </div>
                <FormControl>
                  <Textarea
                    placeholder="Enter circuit IDs, one per line&#10;e.g.,&#10;b,1-2 or b 1 2&#10;n,15-16 or n 15 16&#10;lg,33-36 or lg 33 36"
                    value={field.value?.join('\n') || ''}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n');
                      field.onChange(lines);
                    }}
                    data-testid="textarea-circuit-ids"
                    rows={6}
                    className="font-mono text-sm resize-none"
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Use spaces or standard format (prefix,start-end). Fiber positions will be auto-calculated.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex gap-2 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            data-testid="button-cancel-cable"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save-cable">
            {isLoading ? "Saving..." : cable ? "Update Cable" : "Create Cable"}
          </Button>
        </div>
      </form>

      <OcrDialog
        open={ocrDialogOpen}
        onOpenChange={setOcrDialogOpen}
        onTextExtracted={(text) => {
          // Get current circuit IDs
          const currentValue = form.getValues('circuitIds') || [];
          const currentText = currentValue.join('\n');
          
          // Append extracted text
          const newText = currentText ? `${currentText}\n${text}` : text;
          const newLines = newText.split('\n').filter(line => line.trim());
          
          // Update form
          form.setValue('circuitIds', newLines);
        }}
      />
    </Form>
  );
}
