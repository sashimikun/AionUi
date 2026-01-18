/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getScheduler } from '@process/schedule/SessionScheduler';

export function initSchedulerBridge(): void {
  // Initialize scheduler to start loading tasks
  getScheduler();

  ipcBridge.scheduler.createTask.provider(async (params) => {
    try {
      const scheduler = getScheduler();
      const task = scheduler.createTask(params);
      return task;
    } catch (error) {
      console.error('[schedulerBridge] Failed to create task:', error);
      throw error;
    }
  });

  ipcBridge.scheduler.updateTask.provider(async (params) => {
    try {
      const scheduler = getScheduler();
      return scheduler.updateTask(params.taskId, params.updates);
    } catch (error) {
      console.error('[schedulerBridge] Failed to update task:', error);
      return false;
    }
  });

  ipcBridge.scheduler.deleteTask.provider(async (params) => {
    try {
      const scheduler = getScheduler();
      return scheduler.deleteTask(params.taskId);
    } catch (error) {
      console.error('[schedulerBridge] Failed to delete task:', error);
      return false;
    }
  });

  ipcBridge.scheduler.getTasks.provider(async (params) => {
    try {
      const scheduler = getScheduler();
      return scheduler.getTasks(params.conversationId);
    } catch (error) {
      console.error('[schedulerBridge] Failed to get tasks:', error);
      return [];
    }
  });
}
