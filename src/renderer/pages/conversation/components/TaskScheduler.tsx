/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, DatePicker, Select, List, Typography, Message } from '@arco-design/web-react';
import { IconPlus, IconDelete, IconPlayArrow, IconPause } from '@arco-design/web-react/icon';
import { ipcBridge } from '@/common';
import type { IScheduledTask } from '@/process/database/types';
import dayjs from 'dayjs';

const TaskScheduler: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const [tasks, setTasks] = useState<IScheduledTask[]>([]);
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    ipcBridge.scheduler.getTasks.invoke({ conversationId }).then(setTasks);
  }, [conversationId, refreshKey]);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      const scheduleValue = values.schedule_type === 'once' ? values.schedule_value.valueOf().toString() : values.schedule_value;

      await ipcBridge.scheduler.createTask.invoke({
        conversation_id: conversationId,
        schedule_type: values.schedule_type,
        schedule_value: scheduleValue,
        task_data: {
          prompt: values.prompt,
        },
      });

      Message.success('Task created successfully');
      setVisible(false);
      form.resetFields();
      setRefreshKey(k => k + 1);
    } catch (error) {
      Message.error('Failed to create task');
      console.error(error);
    }
  };

  const toggleTask = async (task: IScheduledTask) => {
    await ipcBridge.scheduler.updateTask.invoke({
      taskId: task.id,
      updates: { is_active: !task.is_active },
    });
    setRefreshKey(k => k + 1);
  };

  const deleteTask = async (taskId: string) => {
      await ipcBridge.scheduler.deleteTask.invoke({ taskId });
      setRefreshKey(k => k + 1);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Typography.Title heading={6} style={{ margin: 0 }}>Scheduled Tasks</Typography.Title>
        <Button size="small" type="primary" icon={<IconPlus />} onClick={() => setVisible(true)}>
          Add Task
        </Button>
      </div>

      <List
        size="small"
        dataSource={tasks}
        render={(task, index) => (
          <List.Item key={task.id} actions={[
             <Button key="toggle" type="text" size="mini" icon={task.is_active ? <IconPause /> : <IconPlayArrow />} onClick={() => toggleTask(task)} />,
             <Button key="delete" type="text" status="danger" size="mini" icon={<IconDelete />} onClick={() => deleteTask(task.id)} />
          ]}>
            <List.Item.Meta
              title={
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{task.task_data.prompt}</span>
                    {!task.is_active && <Typography.Text type="secondary">(Paused)</Typography.Text>}
                 </div>
              }
              description={
                  <div>
                     Type: {task.schedule_type},
                     Value: {task.schedule_type === 'once' ? dayjs(parseInt(task.schedule_value)).format('YYYY-MM-DD HH:mm:ss') : task.schedule_value}
                     {task.next_run_at && <div>Next run: {dayjs(task.next_run_at).format('YYYY-MM-DD HH:mm:ss')}</div>}
                  </div>
              }
            />
          </List.Item>
        )}
      />

      <Modal
        title="Create Scheduled Task"
        visible={visible}
        onOk={handleSubmit}
        onCancel={() => setVisible(false)}
        autoFocus={false}
        focusLock={true}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Prompt" field="prompt" rules={[{ required: true }]}>
            <Input.TextArea placeholder="Enter the prompt to send" />
          </Form.Item>
          <Form.Item label="Type" field="schedule_type" initialValue="once" rules={[{ required: true }]}>
            <Select>
                <Select.Option value="once">Once</Select.Option>
                <Select.Option value="cron">Cron</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item shouldUpdate={(prev, next) => prev.schedule_type !== next.schedule_type} noStyle>
            {(values) => {
                return values.schedule_type === 'once' ? (
                   <Form.Item label="Time" field="schedule_value" rules={[{ required: true }]}>
                       <DatePicker showTime style={{ width: '100%' }} />
                   </Form.Item>
                ) : (
                   <Form.Item label="Cron Expression" field="schedule_value" rules={[{ required: true }]}>
                       <Input placeholder="* * * * *" />
                   </Form.Item>
                );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskScheduler;
