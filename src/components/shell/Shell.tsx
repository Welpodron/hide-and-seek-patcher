import {
  Button,
  Group,
  Progress,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { CONFIG } from "../../../config";

export const Shell = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [token, setToken] = useState(CONFIG.OCTOKIT_TOKEN);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const _window = window as any;
    _window.electronAPI.handleLog((event: any, message: string) => {
      setMessages((prev) => [...prev, message]);

      if (message.includes("ERROR")) {
        console.error(`%c${message}`, "color: red");
      } else if (message.includes("SUCCESS")) {
        console.log(`%c${message}`, "color: green");
      } else {
        console.log(message);
      }

      scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 100;
    });
    _window.electronAPI.handleProgress(
      (
        event: any,
        progressObj: {
          progress: number;
          status: string;
        }
      ) => {
        setProgress(progressObj.progress);
        setProgressStatus(progressObj.status);
      }
    );
  }, [setMessages, setProgress, setProgressStatus, scrollRef, setIsSyncing]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 100;
  }, [messages, scrollRef]);

  const handleBtnUpdateClick = useCallback(
    async (branch: string) => {
      setIsSyncing(true);
      setMessages([]);
      setProgress(0);
      setProgressStatus("");

      const _window = window as any;

      if (!_window.electronAPI.sync) {
        return setIsSyncing(false);
      }

      try {
        await _window.electronAPI.sync({
          branch,
          token,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsSyncing(false);
      }
    },
    [setIsSyncing, setMessages, token]
  );

  return (
    <Stack
      sx={() => ({
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateRows: "8px 1fr 80px",
        gridTemplateColumns: "1fr",
      })}
      spacing={0}
      p={0}
    >
      <Progress
        value={progress}
        radius={0}
        animate={isSyncing}
        color={
          progressStatus.includes("ERROR")
            ? "red"
            : progressStatus.includes("SUCCESS")
            ? "green"
            : "blue"
        }
      />
      <Stack
        sx={() => ({
          overflowY: "auto",
        })}
        ref={scrollRef}
        pos="relative"
        p="xl"
        spacing="sm"
      >
        {messages.map((message, index) => (
          <Text
            key={index}
            fz="sm"
            color={
              message.includes("ERROR")
                ? "red"
                : message.includes("SUCCESS")
                ? "green"
                : "gray"
            }
          >
            {message}
          </Text>
        ))}
      </Stack>

      <Group
        sx={(theme) => ({
          backgroundColor: theme.colors.gray[0],
        })}
        p="xl"
        position="apart"
      >
        <Group>
          <Text fz="sm">Ветка:</Text>
          <Select
            placeholder="Версия сборки"
            value="HEAD"
            disabled={true}
            data={[{ label: "main", value: "HEAD" }]}
            w={150}
          />
          <Text fz="sm">Токен:</Text>
          <TextInput
            value={token}
            onChange={(event) => setToken(event.currentTarget.value)}
          />
        </Group>
        <Button
          loading={isSyncing}
          onClick={() => {
            handleBtnUpdateClick("HEAD");
          }}
        >
          {isSyncing ? "Обновление..." : "Обновить"}
        </Button>
      </Group>
    </Stack>
  );
};
