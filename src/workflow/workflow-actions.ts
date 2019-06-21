import { Logger } from '@nestjs/common';

const logger = new Logger('WorkflowActions');

export const workflowActions = {
  disableAllAttributes: (context, event, actionMeta) => {
    // No implementation needed on server side
  },
  disableAttributes: (context, event, actionMeta) => {
    // No implementation needed on server side
  },
  disableAttributeSelection: (context, event, actionMeta) => {
    // No implementation needed on server side
  },
  showMessage: (context, event, actionMeta) => {
    logger.log('Message: ', actionMeta.action.message);
  },
  setPropertyError: (context, event, actionMeta) => {
    if (!context.errors) {
      context.errors = [];
    }
    context.errors.push({
      property: actionMeta.action.property,
      message: actionMeta.action.message,
    });
  },
  defineBackReferenceNode: (context, event, actionMeta) => {
    console.log('defineBackReferenceNode actionMeta', actionMeta.action);
  },
};
