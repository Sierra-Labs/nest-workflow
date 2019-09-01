import { Logger } from '@nestjs/common';
import { WorkflowContext } from './workflow.machine';

const logger = new Logger('WorkflowServices');

export const workflowServices = {
  update: async (context: WorkflowContext, event): Promise<any> => {
    // deprecate (make sure no longer used in workflows before removing)
    return await workflowServices.upsert(context, event);
  },
  upsert: async (context: WorkflowContext, event): Promise<any> => {
    console.log('workflowServices upsertWithoutWorkflow');
    return await context.nodeDataService.upsertWithoutWorkflow(
      context.transactionalEntityManager,
      context.nodeSchemaDto,
      context.nodeDataDto,
      context.upsertNodeDataDto,
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
