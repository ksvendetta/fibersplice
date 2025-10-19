import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { storage } from "./storage";

// Storage-based query function (replaces API fetch)
export const getQueryFn: <T>() => QueryFunction<T> =
  () =>
  async ({ queryKey }) => {
    const [endpoint, ...params] = queryKey as [string, ...any[]];
    
    // Map API endpoints to storage methods
    switch (endpoint) {
      case '/api/cables':
        return await storage.getAllCables() as any;
      case '/api/circuits':
        return await storage.getAllCircuits() as any;
      case '/api/circuits/cable':
        // Get circuits for a specific cable (params[0] is the cable ID)
        if (params.length > 0) {
          return await storage.getCircuitsByCableId(params[0]) as any;
        }
        throw new Error('Cable ID required for /api/circuits/cable');
      case '/api/saves':
        return await storage.getAllSaves() as any;
      default:
        // For specific resource queries like /api/cables/:id
        if (endpoint.startsWith('/api/cables/') && params.length === 0) {
          const id = endpoint.split('/').pop();
          return await storage.getCable(id!) as any;
        }
        if (endpoint.startsWith('/api/circuits/') && params.length === 0) {
          const id = endpoint.split('/').pop();
          return await storage.getCircuit(id!) as any;
        }
        if (endpoint.startsWith('/api/saves/') && params.length === 0) {
          const id = endpoint.split('/').pop();
          return await storage.getSave(id!) as any;
        }
        throw new Error(`Unknown query endpoint: ${endpoint}`);
    }
  };

// Storage-based API request (replaces fetch for mutations)
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<{ json: () => Promise<any> }> {
  // Parse the URL and method to determine which storage operation to call
  const path = url.replace(/^\/api\//, '');
  const [resource, id, ...rest] = path.split('/');
  
  try {
    let result: any;
    
    if (method === 'POST') {
      if (resource === 'cables') {
        result = await storage.createCable(data as any);
      } else if (resource === 'circuits') {
        // Calculate circuit fiber positions before creating
        const circuitData = data as any;
        const cable = await storage.getCable(circuitData.cableId);
        if (!cable) throw new Error('Cable not found');
        
        // Parse circuit ID to get fiber count (format: "prefix,start-end")
        const parts = circuitData.circuitId.split(',');
        if (parts.length !== 2) throw new Error('Invalid circuit ID format');
        const rangeParts = parts[1].split('-');
        if (rangeParts.length !== 2) throw new Error('Invalid range format');
        const rangeStart = parseInt(rangeParts[0]);
        const rangeEnd = parseInt(rangeParts[1]);
        if (isNaN(rangeStart) || isNaN(rangeEnd)) throw new Error('Invalid range values');
        const fiberCount = rangeEnd - rangeStart + 1;
        
        // Get existing circuits to calculate position and fiber start
        const existingCircuits = await storage.getCircuitsByCableId(circuitData.cableId);
        const position = existingCircuits.length;
        
        let fiberStart = 1;
        if (existingCircuits.length > 0) {
          const lastCircuit = existingCircuits[existingCircuits.length - 1];
          fiberStart = lastCircuit.fiberEnd + 1;
        }
        
        const fiberEnd = fiberStart + fiberCount - 1;
        
        // Validate fiber range
        if (fiberEnd > cable.fiberCount) {
          throw new Error(`Circuit requires ${fiberCount} fibers but only ${cable.fiberCount - fiberStart + 1} fibers remaining`);
        }
        
        result = await storage.createCircuit({
          ...circuitData,
          position,
          fiberStart,
          fiberEnd
        });
      } else if (resource === 'saves') {
        const { name } = data as any;
        result = await storage.createSave(name);
      }
    } else if (method === 'PATCH' || method === 'PUT') {
      if (resource === 'cables') {
        // Update cable
        await storage.updateCable(id, data as any);
        result = { success: true };
      } else if (resource === 'circuits' && rest.includes('toggle-spliced')) {
        // Toggle splice status
        const circuit = await storage.getCircuit(id);
        if (!circuit) throw new Error('Circuit not found');
        
        const newSplicedStatus = circuit.isSpliced === 1 ? 0 : 1;
        const updateData: any = { isSpliced: newSplicedStatus };
        
        if (newSplicedStatus === 1) {
          // Setting to spliced - include feed cable info
          const { feedCableId, feedFiberStart, feedFiberEnd } = data as any;
          updateData.feedCableId = feedCableId || null;
          updateData.feedFiberStart = feedFiberStart !== undefined ? feedFiberStart : null;
          updateData.feedFiberEnd = feedFiberEnd !== undefined ? feedFiberEnd : null;
        } else {
          // Setting to unspliced - clear feed cable info
          updateData.feedCableId = null;
          updateData.feedFiberStart = null;
          updateData.feedFiberEnd = null;
        }
        
        await storage.updateCircuit(id, updateData);
        result = { success: true };
      } else if (resource === 'circuits') {
        await storage.updateCircuit(id, data as any);
        result = { success: true };
      }
    } else if (method === 'DELETE') {
      if (resource === 'cables') {
        await storage.deleteCable(id);
        result = { success: true };
      } else if (resource === 'circuits') {
        await storage.deleteCircuit(id);
        result = { success: true };
      } else if (resource === 'saves') {
        if (id === 'load') {
          const { id: saveId } = data as any;
          await storage.loadSave(saveId);
          result = { success: true };
        } else if (url.includes('/reset')) {
          await storage.resetAllData();
          result = { success: true };
        } else {
          await storage.deleteSave(id);
          result = { success: true };
        }
      }
    }
    
    return {
      json: async () => result
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Storage operation failed');
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
