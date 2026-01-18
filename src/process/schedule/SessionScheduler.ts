/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import schedule from 'node-schedule';
import { getDatabase } from '@process/database';
import type { IScheduledTask } from '@process/database/types';
import WorkerManage from '@process/WorkerManage';
import { uuid } from '@/common/utils';

export class SessionScheduler {
  private jobs: Map<string, schedule.Job> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    const db = getDatabase();
    const result = db.getAllActiveTasks();
    if (result.success && result.data) {
      result.data.forEach((task) => {
        this.scheduleTask(task);
      });
    }
    console.log(`[SessionScheduler] Initialized with ${this.jobs.size} active tasks`);
  }

  public createTask(params: Omit<IScheduledTask, 'id' | 'is_active' | 'created_at' | 'last_run_at' | 'next_run_at'>): IScheduledTask {
    const task: IScheduledTask = {
      id: uuid(),
      ...params,
      is_active: true,
      created_at: Date.now(),
    };

    const db = getDatabase();
    const result = db.createTask(task);
    if (result.success) {
      this.scheduleTask(task);
      return task;
    }
    throw new Error(result.error || 'Failed to create task');
  }

  public updateTask(taskId: string, updates: Partial<IScheduledTask>): boolean {
    const db = getDatabase();
    const result = db.updateTask(taskId, updates);
    if (result.success) {
      // Reload task to get full data
      const taskResult = db.getTask(taskId);
      if (taskResult.success && taskResult.data) {
        // Cancel existing job
        this.cancelJob(taskId);
        // Reschedule if active
        if (taskResult.data.is_active) {
          this.scheduleTask(taskResult.data);
        }
        return true;
      }
    }
    return false;
  }

  public deleteTask(taskId: string): boolean {
    const db = getDatabase();
    const result = db.deleteTask(taskId);
    if (result.success) {
      this.cancelJob(taskId);
      return true;
    }
    return false;
  }

  public getTasks(conversationId: string): IScheduledTask[] {
    const db = getDatabase();
    const result = db.getConversationTasks(conversationId);
    if (result.success && result.data) {
      return result.data;
    }
    return [];
  }

  private cancelJob(taskId: string) {
    const job = this.jobs.get(taskId);
    if (job) {
      job.cancel();
      this.jobs.delete(taskId);
    }
  }

  private scheduleTask(task: IScheduledTask) {
    let job: schedule.Job | null = null;

    const jobFunction = async () => {
      console.log(`[SessionScheduler] Running task ${task.id}`);
      try {
        await this.executeTask(task);

        // Update last_run_at
        const db = getDatabase();
        const now = Date.now();

        const updates: Partial<IScheduledTask> = {
          last_run_at: now,
        };

        if (task.schedule_type === 'once') {
          updates.is_active = false;
          this.cancelJob(task.id);
        } else {
          const nextRun = this.jobs.get(task.id)?.nextInvocation();
          if (nextRun) {
            updates.next_run_at = nextRun.getTime();
          }
        }

        db.updateTask(task.id, updates);
      } catch (error) {
        console.error(`[SessionScheduler] Task ${task.id} failed:`, error);
      }
    };

    try {
      if (task.schedule_type === 'cron') {
        job = schedule.scheduleJob(task.schedule_value, jobFunction);
      } else if (task.schedule_type === 'once') {
        const date = new Date(parseInt(task.schedule_value));
        if (date.getTime() <= Date.now()) {
          console.warn(`[SessionScheduler] Task ${task.id} is scheduled in the past. Skipping.`);
          // Mark as inactive?
          // const db = getDatabase();
          // db.updateTask(task.id, { is_active: false });
          return;
        }
        job = schedule.scheduleJob(date, jobFunction);
      } else if (task.schedule_type === 'interval') {
         // Treat interval as ms for now, convert to recurrence if possible or use simple setInterval wrapper
         // For simplicity, let's assume interval is not supported yet or use a simple hack if needed.
         // Or just log warning.
         console.warn(`[SessionScheduler] Interval type not fully supported yet for task ${task.id}`);
      }
    } catch (e) {
      console.error(`[SessionScheduler] Failed to schedule task ${task.id}:`, e);
    }

    if (job) {
      this.jobs.set(task.id, job);

      // Update next_run_at
      const nextRun = job.nextInvocation();
      if (nextRun) {
        const db = getDatabase();
        db.updateTask(task.id, { next_run_at: nextRun.getTime() });
      }
    }
  }

  private async executeTask(task: IScheduledTask) {
    const manager = await WorkerManage.getTaskByIdRollbackBuild(task.conversation_id);
    if (!manager) {
      throw new Error('Agent manager not found');
    }

    const params = {
      content: task.task_data.prompt,
      input: task.task_data.prompt,
      files: task.task_data.files,
      msg_id: uuid(),
      isSystemTrigger: true,
    };

    // Call sendMessage
    // @ts-ignore
    await manager.sendMessage(params);
  }
}

// Singleton
let schedulerInstance: SessionScheduler | null = null;

export function getScheduler(): SessionScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new SessionScheduler();
  }
  return schedulerInstance;
}
