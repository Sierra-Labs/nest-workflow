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
    if (guardMeta.cond.hasOwnProperty('value')) {
      return context.nodeDataDto && propertyValue === guardMeta.cond.value;
    } else if (
      guardMeta.cond.not &&
      guardMeta.cond.not.hasOwnProperty('value')
    ) {
      return context.nodeDataDto && propertyValue !== guardMeta.cond.not.value;
    } else if (
      guardMeta.cond.not &&
      guardMeta.cond.not.hasOwnProperty('property')
    ) {
      return (
        context.nodeDataDto &&
        propertyValue !== context.nodeDataDto[guardMeta.cond.not.property]
      );
    } else if (
      guardMeta.cond.moreThan &&
      guardMeta.cond.moreThan.hasOwnProperty('value')
    ) {
      return (
        context.nodeDataDto && propertyValue > guardMeta.cond.moreThan.value
      );
    } else if (
      guardMeta.cond.moreThan &&
      guardMeta.cond.moreThan.hasOwnProperty('property')
    ) {
      return (
        context.nodeDataDto &&
        propertyValue > context.nodeDataDto[guardMeta.cond.moreThan.property]
      );
    } else if (
      guardMeta.cond.moreThanOrEqual &&
      guardMeta.cond.moreThanOrEqual.hasOwnProperty('value')
    ) {
      return (
        context.nodeDataDto &&
        propertyValue >= guardMeta.cond.moreThanOrEqual.value
      );
    } else if (
      guardMeta.cond.moreThanOrEqual &&
      guardMeta.cond.moreThanOrEqual.hasOwnProperty('property')
    ) {
      return (
        context.nodeDataDto &&
        propertyValue >=
          context.nodeDataDto[guardMeta.cond.moreThanOrEqual.property]
      );
    } else if (
      guardMeta.cond.lessThan &&
      guardMeta.cond.lessThan.hasOwnProperty('value')
    ) {
      return (
        context.nodeDataDto && propertyValue < guardMeta.cond.lessThan.value
      );
    } else if (
      guardMeta.cond.lessThan &&
      guardMeta.cond.lessThan.hasOwnProperty('property')
    ) {
      return (
        context.nodeDataDto &&
        propertyValue < context.nodeDataDto[guardMeta.cond.lessThan.property]
      );
    } else if (
      guardMeta.cond.lessThanOrEqual &&
      guardMeta.cond.lessThanOrEqual.hasOwnProperty('value')
    ) {
      return (
        context.nodeDataDto &&
        propertyValue <= guardMeta.cond.lessThanOrEqual.value
      );
    } else if (
      guardMeta.cond.lessThanOrEqual &&
      guardMeta.cond.lessThanOrEqual.hasOwnProperty('property')
    ) {
      return (
        context.nodeDataDto &&
        propertyValue <=
          context.nodeDataDto[guardMeta.cond.lessThanOrEqual.property]
      );
    }
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
        if (!context.nodeDataDto.hasOwnProperty(property)) {
          return false;
        }
      }
      return true;
    } else if (guardMeta.cond.property) {
      if (!context.nodeDataDto.hasOwnProperty(guardMeta.cond.property)) {
        return false;
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
