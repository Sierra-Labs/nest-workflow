import { Logger } from '@nestjs/common';
import { WorkflowContext } from './workflow.machine';

const logger = new Logger('WorkflowServices');

export const workflowServices = {
  update: async (context: WorkflowContext, event): Promise<any> => {
    console.log('workflowServices updateWithTransaction');
    return context.nodeDataService.updateWithTransaction(
      context.transactionalEntityManager,
      context.node,
      context.nodeDataDto,
      context.user,
    );
  },
  addReferenceNode: async (context: WorkflowContext, event): Promise<any> => {
    console.log('workflowServices addReferenceNode', event);
    return;
  },
  addBackReferenceNode: (context: WorkflowContext, event): Promise<any> => {
    return Promise.resolve();
  },
};
