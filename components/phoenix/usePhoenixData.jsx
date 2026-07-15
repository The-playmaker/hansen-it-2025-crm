"use client";

import { useEffect, useMemo, useState } from "react";
import { PHOENIX_STORAGE_KEY, phoenixMockData } from "@/lib/phoenixMockData";

function cloneInitialData() {
  return JSON.parse(JSON.stringify(phoenixMockData));
}

function mergeWithInitialData(savedData) {
  return {
    ...cloneInitialData(),
    ...savedData,
    siteContent: {
      ...cloneInitialData().siteContent,
      ...(savedData?.siteContent || {})
    }
  };
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function usePhoenixData() {
  const [data, setData] = useState(cloneInitialData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(PHOENIX_STORAGE_KEY);
    if (saved) {
      try {
        setData(mergeWithInitialData(JSON.parse(saved)));
      } catch {
        setData(cloneInitialData());
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      // TODO: Replace this localStorage store with Supabase tables for Phoenix customers, contacts, tasks, quotes and ideas.
      window.localStorage.setItem(PHOENIX_STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, ready]);

  const customersById = useMemo(() => new Map(data.customers.map((customer) => [customer.id, customer])), [data.customers]);

  const upsert = (collection, item, prefix) => {
    setData((current) => {
      const exists = item.id && current[collection].some((entry) => entry.id === item.id);
      const nextItem = exists ? item : { ...item, id: createId(prefix) };
      return {
        ...current,
        [collection]: exists
          ? current[collection].map((entry) => (entry.id === item.id ? nextItem : entry))
          : [nextItem, ...current[collection]]
      };
    });
  };

  const remove = (collection, id) => {
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((entry) => entry.id !== id)
    }));
  };

  const parkTaskAsIdea = (taskId) => {
    setData((current) => {
      const task = current.tasks.find((entry) => entry.id === taskId);
      if (!task) return current;

      const customer = current.customers.find((entry) => entry.id === task.customerId);
      const idea = {
        id: createId("ide"),
        title: task.title,
        description: [
          task.description,
          customer ? "Tidligere oppgave for " + customer.companyName + "." : null,
          task.dueDate ? "Opprinnelig frist: " + task.dueDate + "." : null
        ].filter(Boolean).join("\n"),
        category: "Parkert oppgave",
        status: "parkert"
      };

      return {
        ...current,
        tasks: current.tasks.filter((entry) => entry.id !== taskId),
        ideas: [idea, ...current.ideas]
      };
    });
  };

  const exportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      storageKey: PHOENIX_STORAGE_KEY,
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "project-phoenix-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const reset = () => setData(cloneInitialData());

  return { data, setData, customersById, upsert, remove, parkTaskAsIdea, exportBackup, reset };
}
