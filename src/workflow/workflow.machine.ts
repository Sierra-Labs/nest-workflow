import { EntityManager } from 'typeorm';
import {
  EventObject,
  interpret,
  Interpreter,
  Machine,
  MachineConfig,
  State,
  StateMachine,
  StateSchema,
} from 'xstate';

import { User, Node } from '../entities';
import { NodeDataDto, NodeDataService, NodeSchemaDto } from '../node';
import { workflowActions } from './workflow-actions';
import { workflowGuards } from './workflow-guards';
import { workflowServices } from './workflow-services';

export interface WorkflowContextError {
  property: string;
  message: string;
}

export interface WorkflowContext {
  // reference to the nodeDataService for use in actions/guards
  nodeDataService: NodeDataService;
  // reference to the sql transaction
  transactionalEntityManager: EntityManager;
  // reference to the user initiating the workflow
  user: User;
  nodeSchemaDto: NodeSchemaDto;
  nodeDataDto: NodeDataDto; // the dto used for validation checks
  upsertNodeDataDto: NodeDataDto; // the dto used for upsert
  originalNodeDataDto: NodeDataDto; // The original nodeDataDto for comparison
  errors?: WorkflowContextError[];
}

export class WorkflowMachine {
  static setWorkflowGuards(guards) {
    Object.assign(workflowGuards, guards);
  }
  static setWorkflowActions(actions) {
    Object.assign(workflowActions, actions);
  }

  createMachine(
    machineConfig: MachineConfig<WorkflowContext, any, any>,
  ): StateMachine<WorkflowContext, any, any> {
    return Machine<WorkflowContext, any, any>(machineConfig, {
      guards: workflowGuards,
      actions: workflowActions,
      services: workflowServices,
    });
  }

  async run(
    machineConfig: MachineConfig<WorkflowContext, any, any>,
  ): Promise<State<WorkflowContext, any>> {
    const machine = this.createMachine(machineConfig);
    return new Promise((resolve, reject) => {
      console.log('starting service');
      const service = interpret(machine);
      // service.onEvent(results => {
      //   console.log('onEvent', results);
      // });
      service.onTransition(results => {
        console.log('onTransition', results.value);
        // service.stop();
        // resolve(results);
      });
      service.onDone(results => {
        console.log('onDone', results);
        service.stop();
        resolve(service.state);
      });
      service.start();
    });
    // const state$ = fromEventPattern(
    //   handler => {
    //     this.service
    //       .onEvent(results => {
    //         console.log('event', results);
    //       })
    //       // .onEvent((eventConttext, stateSchema, event) => {
    //       //   console.log('onEvent', eventConttext, stateSchema, event);
    //       // })
    //       // Listen for state transitions
    //       .onTransition(handler as any)
    //       // Start the service
    //       .start();

    //     return this.service;
    //   },
    //   (handler, callbackService) => callbackService.stop(),
    // );
    // return state$.pipe(
    //   map(results => {
    //     console.log('$state$ results', results);
    //     return results[0] as State<any, any>;
    //   }),
    // );
  }
}
