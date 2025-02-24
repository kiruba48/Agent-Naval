import { MessageProcessor } from './MessageProcessor';
import { SummaryService } from './SummaryService';

/**
 * Initialize all services and their dependencies
 */
export function initializeServices() {
  // Get service instances
  const messageProcessor = MessageProcessor.getInstance();

  // Temporarily disable summary service
  // const summaryService = SummaryService.getInstance();
  // messageProcessor.initializeDependencies(summaryService);
  // summaryService.initializeDependencies(messageProcessor);

  return {
    messageProcessor,
    // summaryService
  };
}

// Initialize services and export instances
const { messageProcessor } = initializeServices();
export { messageProcessor };
