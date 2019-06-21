import * as _ from 'lodash';

export const workflowGuards = {
  hasMany: (context, event, guardMeta) => {
    if (!context.nodeDataDto) {
      return false;
    }
    if (guardMeta.cond.properties) {
      for (const property of guardMeta.cond.properties) {
        if (
          !(context.nodeDataDto[property] instanceof Array) ||
          context.nodeDataDto[property].length === 0
        ) {
          return false;
        }
      }
      return true;
    }
  },
  matchProperty: (context, event, guardMeta) => {
    const propertyValue = _.get(context.nodeDataDto, guardMeta.cond.property);
    return context.nodeDataDto && propertyValue === guardMeta.cond.value;
  },
  setPropertyError: (context, event, guardMeta) => {
    if (!context.errors) {
      context.errors = [];
    }
    context.errors.push({
      property: guardMeta.cond.property,
      message: guardMeta.cond.message,
    });
    return true;
  },
  hasProperty: (context, event, guardMeta) => {
    if (!context.nodeDataDto) {
      return false;
    }
    if (guardMeta.cond.properties) {
      for (const property of guardMeta.cond.properties) {
        if (!context.nodeDataDto[property]) {
          return false;
        }
      }
      return true;
    }
  },
  setProperty: (context, event, guardMeta) => {
    if (!context.nodeDataDto) {
      return false;
    }
    context.nodeDataDto[guardMeta.cond.property] = guardMeta.cond.value;
    return true;
  },
  isEmptyProperty: (context, event, guardMeta) => {
    const propertyValue = _.get(context.nodeDataDto, guardMeta.cond.property);
    return (
      !propertyValue ||
      (propertyValue instanceof Array && propertyValue.length === 0)
    );
  },
};
