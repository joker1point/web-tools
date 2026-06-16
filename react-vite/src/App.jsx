import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ConfigProvider,
  theme as antdTheme,
  Layout,
  Typography,
  Input,
  AutoComplete,
  Select,
  Button,
  Table,
  Card,
  Space,
  Tag,
  Switch,
  Alert,
  Spin,
  Statistic,
  Row,
  Col,
  Tooltip,
  Divider,
  Badge,
  Empty,
  Flex,
} from 'antd';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleOutlined,
  CodeOutlined,
  SendOutlined,
  ReloadOutlined,
  BulbOutlined,
  BulbFilled,
  SearchOutlined,
  LinkOutlined,
  KeyOutlined,
  GlobalOutlined,
  FieldTimeOutlined,
  DashboardOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

/* ── Provider presets ─────────────────────────────────────────── */
const PROVIDERS = [
  { label: 'OpenAI', value: 'https://api.openai.com' },
  { label: 'Anthropic', value: 'https://api.anthropic.com' },
  { label: 'Google Gemini (OpenAI-compat)', value: 'https://generativelanguage.googleapis.com' },
  { label: 'DeepSeek', value: 'https://api.deepseek.com' },
  { label: 'Moonshot', value: 'https://api.moonshot.cn' },
  { label: '智谱 AI (Zhipu)', value: 'https://open.bigmodel.cn' },
  { label: '通义千问 (Qwen)', value: 'https://dashscope.aliyuncs.com/compatible-mode' },
  { label: 'SiliconFlow', value: 'https://api.siliconflow.cn' },
  { label: 'Together AI', value: 'https://api.together.xyz' },
  { label: 'Groq', value: 'https://api.groq.com/openai' },
  { label: 'Mistral AI', value: 'https://api.mistral.ai' },
  { label: '零一万物 (01.AI)', value: 'https://api.lingyiwanwu.com' },
  { label: '百川智能 (Baichuan)', value: 'https://api.baichuan-ai.com' },
  { label: 'MiniMax', value: 'https://api.minimax.chat' },
  { label: 'Agnes AI', value: 'https://apihub.agnes-ai.com' },
];

/* ── Seed tokens ──────────────────────────────────────────────── */
const SEEDS = {
  light: {
    '--seed-bg': '#ffffff',
    '--seed-surface': '#f6f8fa',
    '--seed-fg': '#1f2328',
    '--seed-muted': '#656d76',
    '--seed-border': '#d0d7de',
    '--seed-primary': '#0969da',
    '--seed-accent': '#1a7f37',
    '--seed-danger': '#cf222e',
    '--seed-warn': '#9a6700',
    '--seed-radius': '6px',
  },
  dark: {
    '--seed-bg': '#0d1117',
    '--seed-surface': '#161b22',
    '--seed-fg': '#e6edf3',
    '--seed-muted': '#8b949e',
    '--seed-border': '#30363d',
    '--seed-primary': '#58a6ff',
    '--seed-accent': '#3fb950',
    '--seed-danger': '#f85149',
    '--seed-warn': '#d29922',
    '--seed-radius': '6px',
  },
};

/* ── Helpers ──────────────────────────────────────────────────── */

function isCustomUrl(baseURL, providers) {
  return !providers.some((p) => p.value === baseURL) && baseURL !== '';
}

function buildHeaders(apiKey, baseURL) {
  const headers = { 'Content-Type': 'application/json' };
  if (baseURL.includes('anthropic.com')) {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

async function fetchModels(baseURL, apiKey, signal) {
  const url = `${baseURL}/v1/models`;
  const start = performance.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(apiKey, baseURL),
    signal,
  });
  const duration = Math.round(performance.now() - start);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300) || res.statusText}`);
  }
  const data = await res.json();
  return { models: data.data || [], duration };
}

async function testLatency(baseURL, apiKey, modelName, signal) {
  const isAnthropic = baseURL.includes('anthropic.com');
  const url = `${baseURL}/v1/${isAnthropic ? 'messages' : 'chat/completions'}`;

  const body = isAnthropic
    ? {
        model: modelName || 'claude-sonnet-4-20250514',
        max_tokens: 16,
        stream: true,
        messages: [{ role: 'user', content: 'Hi' }],
      }
    : {
        model: modelName || 'gpt-4o-mini',
        max_tokens: 16,
        stream: true,
        messages: [{ role: 'user', content: 'Hi' }],
      };

  const start = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(apiKey, baseURL),
    body: JSON.stringify(body),
    signal,
  });

  const status = res.status;
  let ttft = null;
  let totalDuration = null;

  if (!res.ok) {
    totalDuration = Math.round(performance.now() - start);
    const body = await res.text().catch(() => '');
    return { status, ttft, totalDuration, error: `HTTP ${status}: ${body.slice(0, 300) || res.statusText}` };
  }

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let firstChunk = true;
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (firstChunk) {
          ttft = Math.round(performance.now() - start);
          firstChunk = false;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
      }
    } catch {
      /* stream aborted */
    }

    totalDuration = Math.round(performance.now() - start);

    const lines = fullText.split('\n');
    let content = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content || json.delta?.text || '';
          content += delta;
        } catch {
          /* non-JSON line */
        }
      }
    }

    return { status, ttft, totalDuration, content };
  }

  /* fallback: no streaming */
  const text = await res.text();
  totalDuration = Math.round(performance.now() - start);
  return { status, ttft: totalDuration, totalDuration, content: text.slice(0, 200) };
}

/* ── Component ────────────────────────────────────────────────── */

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('https://api.openai.com');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customURL, setCustomURL] = useState('');
  const [modelName, setModelName] = useState('gpt-4o-mini');

  /* model test state */
  const [modelLoading, setModelLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [modelDuration, setModelDuration] = useState(null);
  const [modelError, setModelError] = useState(null);

  /* latency test state */
  const [latencyLoading, setLatencyLoading] = useState(false);
  const [latencyResults, setLatencyResults] = useState([]);
  const [latencyError, setLatencyError] = useState(null);

  const activeURL = showCustomInput ? customURL : baseURL;
  const isConfigReady = apiKey.trim() !== '' && activeURL.trim() !== '';

  const seedTokens = darkMode ? SEEDS.dark : SEEDS.light;

  /* sync seed CSS custom properties to DOM for var() consumption */
  useEffect(() => {
    const root = document.documentElement;
    const tokens = darkMode ? SEEDS.dark : SEEDS.light;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [darkMode]);

  const antTheme = useMemo(
    () => ({
      algorithm: darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: darkMode ? '#58a6ff' : '#0969da',
        colorSuccess: darkMode ? '#3fb950' : '#1a7f37',
        colorError: darkMode ? '#f85149' : '#cf222e',
        colorWarning: darkMode ? '#d29922' : '#9a6700',
        borderRadius: 6,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
        fontSize: 14,
        controlHeight: 32,
        colorBgContainer: darkMode ? '#161b22' : '#ffffff',
        colorBgLayout: darkMode ? '#0d1117' : '#f6f8fa',
        colorBorder: darkMode ? '#30363d' : '#d0d7de',
      },
      components: {
        Card: {
          paddingLG: 20,
        },
        Table: {
          headerBg: darkMode ? '#161b22' : '#f6f8fa',
          borderColor: darkMode ? '#30363d' : '#d0d7de',
        },
      },
    }),
    [darkMode]
  );

  /* ── handlers ─────────────────────────────────────────────── */

  const handleProviderChange = useCallback((value) => {
    if (value === '__custom__') {
      setShowCustomInput(true);
      setBaseURL('');
    } else {
      setShowCustomInput(false);
      setBaseURL(value);
      setCustomURL('');
    }
  }, []);

  const handleFetchModels = useCallback(async () => {
    setModelLoading(true);
    setModelError(null);
    setModels([]);
    setModelDuration(null);
    try {
      const result = await fetchModels(activeURL, apiKey);
      setModels(result.models);
      setModelDuration(result.duration);
    } catch (err) {
      setModelError(err.message);
    } finally {
      setModelLoading(false);
    }
  }, [activeURL, apiKey]);

  const handleLatencyTest = useCallback(async () => {
    setLatencyLoading(true);
    setLatencyError(null);
    try {
      const result = await testLatency(activeURL, apiKey, modelName);
      if (result.error) {
        setLatencyError(result.error);
      }
      setLatencyResults((prev) => [
        { ...result, timestamp: new Date().toLocaleTimeString('zh-CN'), model: modelName },
        ...prev,
      ]);
    } catch (err) {
      setLatencyError(err.message);
    } finally {
      setLatencyLoading(false);
    }
  }, [activeURL, apiKey, modelName]);

  /* ── table columns ────────────────────────────────────────── */

  const modelColumns = [
    {
      title: '模型 ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      render: (text) => (
        <Text code style={{ fontSize: 12 }} data-qoder-id="qel-text-8365eb39" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-8365eb39&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:341,&quot;column&quot;:9}}">
          {text}
        </Text>
      ),
    },
    {
      title: '所有者',
      dataIndex: 'owned_by',
      key: 'owned_by',
      width: 160,
      ellipsis: true,
      render: (text) => <Text type="secondary" data-qoder-id="qel-text-8065e680" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-8065e680&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:352,&quot;column&quot;:25}}">{text || '-'}</Text>,
    },
    {
      title: '对象类型',
      dataIndex: 'object',
      key: 'object',
      width: 100,
      render: (text) => <Tag data-qoder-id="qel-tag-18e1b8f1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tag-18e1b8f1&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;tag&quot;,&quot;loc&quot;:{&quot;line&quot;:359,&quot;column&quot;:25}}">{text || 'model'}</Tag>,
    },
  ];

  const latencyColumns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 90 },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      width: 140,
      ellipsis: true,
      render: (text) => (
        <Text code style={{ fontSize: 11 }} data-qoder-id="qel-text-8665eff2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-8665eff2&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:372,&quot;column&quot;:9}}">{text || '-'}</Text>
      ),
    },
    {
      title: '状态码',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s) => (
        <Tag color={s >= 200 && s < 300 ? 'success' : 'error'} data-qoder-id="qel-tag-1ae1bc17" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tag-1ae1bc17&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;tag&quot;,&quot;loc&quot;:{&quot;line&quot;:381,&quot;column&quot;:9}}">{s}</Tag>
      ),
    },
    {
      title: 'TTFT',
      dataIndex: 'ttft',
      key: 'ttft',
      width: 90,
      render: (v) => (v != null ? `${v} ms` : '-'),
    },
    {
      title: '总延迟',
      dataIndex: 'totalDuration',
      key: 'totalDuration',
      width: 90,
      render: (v) => (v != null ? `${v} ms` : '-'),
    },
    {
      title: '响应片段',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text) =>
        text ? (
          <Text code style={{ fontSize: 11 }} data-qoder-id="qel-text-8465eccc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-8465eccc&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:405,&quot;column&quot;:11}}">
            {text.slice(0, 80)}
          </Text>
        ) : (
          <Text type="secondary" data-qoder-id="qel-text-8565ee5f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-8565ee5f&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:409,&quot;column&quot;:11}}">-</Text>
        ),
    },
  ];

  /* ── render ───────────────────────────────────────────────── */

  return (
    <ConfigProvider locale={zhCN} theme={antTheme} data-qoder-id="qel-configprovider-14403aba" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-configprovider-14403aba&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;configprovider&quot;,&quot;loc&quot;:{&quot;line&quot;:417,&quot;column&quot;:5}}">
      <Layout
        data-component="App Root"
        data-od-id="app-root"
        style={{
          minHeight: '100vh',
          background: 'var(--seed-bg)',
          transition: 'background 0.2s ease-out',
        }}
       data-qoder-id="qel-app-root-042846ff" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-app-root-042846ff&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;app-root&quot;,&quot;loc&quot;:{&quot;line&quot;:418,&quot;column&quot;:7}}">
        {/* ── Header ──────────────────────────────────────── */}
        <header
          data-component="Header"
          data-od-id="header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: 56,
            background: 'var(--seed-surface)',
            borderBottom: '1px solid var(--seed-border)',
            flexShrink: 0,
          }}
         data-qoder-id="qel-header-d038bbf3" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-header-d038bbf3&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;header&quot;,&quot;loc&quot;:{&quot;line&quot;:428,&quot;column&quot;:9}}">
          <Space size={10} align="center" data-qoder-id="qel-space-277bc3aa" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-space-277bc3aa&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;space&quot;,&quot;loc&quot;:{&quot;line&quot;:442,&quot;column&quot;:11}}">
            <ApiOutlined
              style={{ fontSize: 20, color: 'var(--seed-primary)' }}
             data-qoder-id="qel-apioutlined-35e7c4cf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-apioutlined-35e7c4cf&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;apioutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:443,&quot;column&quot;:13}}"/>
            <Title
              level={5}
              style={{
                margin: 0,
                color: 'var(--seed-fg)',
                letterSpacing: '-0.01em',
                fontSize: 16,
              }}
             data-qoder-id="qel-title-da04ce94" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-title-da04ce94&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;title&quot;,&quot;loc&quot;:{&quot;line&quot;:446,&quot;column&quot;:13}}">
              API 联通测试
            </Title>
            <Tag
              style={{
                marginLeft: 4,
                fontSize: 11,
                borderRadius: 9999,
                letterSpacing: '0.02em',
              }}
              color={darkMode ? 'blue' : 'processing'}
             data-qoder-id="qel-tag-0451806d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tag-0451806d&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;tag&quot;,&quot;loc&quot;:{&quot;line&quot;:457,&quot;column&quot;:13}}">
              Dashboard
            </Tag>
          </Space>
          <Tooltip title={darkMode ? '切换亮色模式' : '切换暗色模式'} data-qoder-id="qel-tooltip-6887c8f6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tooltip-6887c8f6&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;tooltip&quot;,&quot;loc&quot;:{&quot;line&quot;:469,&quot;column&quot;:11}}">
            <Switch
              checked={darkMode}
              onChange={setDarkMode}
              checkedChildren={<BulbFilled />}
              unCheckedChildren={<BulbOutlined />}
             data-qoder-id="qel-switch-f9c18447" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-switch-f9c18447&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;switch&quot;,&quot;loc&quot;:{&quot;line&quot;:470,&quot;column&quot;:13}}"/>
          </Tooltip>
        </header>

        {/* ── Content ─────────────────────────────────────── */}
        <Content
          data-component="Main Content"
          data-od-id="main-content"
          style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}
         data-qoder-id="qel-main-content-9782308a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-main-content-9782308a&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;main-content&quot;,&quot;loc&quot;:{&quot;line&quot;:480,&quot;column&quot;:9}}">
          <Flex vertical gap={20} data-qoder-id="qel-flex-80cc197f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-80cc197f&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:485,&quot;column&quot;:11}}">
            {/* ── Config Card ─────────────────────────────── */}
            <Card
              data-component="Configuration"
              data-od-id="config-card"
              title={
                <Space data-qoder-id="qel-space-0e7ddae6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-space-0e7ddae6&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;space&quot;,&quot;loc&quot;:{&quot;line&quot;:491,&quot;column&quot;:17}}">
                  <CodeOutlined  data-qoder-id="qel-codeoutlined-c3f02843" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-codeoutlined-c3f02843&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;codeoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:492,&quot;column&quot;:19}}"/>
                  <span style={{ letterSpacing: '0.02em' }} data-qoder-id="qel-span-6f79f414" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-6f79f414&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:493,&quot;column&quot;:19}}">API 配置</span>
                </Space>
              }
             data-qoder-id="qel-configuration-5ec80ff6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-configuration-5ec80ff6&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;configuration&quot;,&quot;loc&quot;:{&quot;line&quot;:487,&quot;column&quot;:13}}">
              <Row gutter={[16, 16]} data-qoder-id="qel-row-a2236167" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-row-a2236167&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;row&quot;,&quot;loc&quot;:{&quot;line&quot;:497,&quot;column&quot;:15}}">
                <Col xs={24} md={12} data-qoder-id="qel-col-f6ffc292" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-f6ffc292&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:498,&quot;column&quot;:17}}">
                  <Text
                    strong
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 12,
                      letterSpacing: '0.02em',
                      color: 'var(--seed-muted)',
                      textTransform: 'uppercase',
                    }}
                   data-qoder-id="qel-text-d56a2eef" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-d56a2eef&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:499,&quot;column&quot;:19}}">
                    <KeyOutlined style={{ marginRight: 6 }}  data-qoder-id="qel-keyoutlined-042f5b94" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-keyoutlined-042f5b94&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;keyoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:510,&quot;column&quot;:21}}"/>
                    API Key
                  </Text>
                  <Input.Password
                    placeholder="sk-... 或对应的 API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    iconRender={(visible) =>
                      visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                    }
                    style={{ fontSize: 13 }}
                    size="large"
                   data-qoder-id="qel-input-password-1aa2c642" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-password-1aa2c642&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;input-password&quot;,&quot;loc&quot;:{&quot;line&quot;:513,&quot;column&quot;:19}}"/>
                </Col>
                <Col xs={24} md={12} data-qoder-id="qel-col-faffc8de" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-faffc8de&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:524,&quot;column&quot;:17}}">
                  <Text
                    strong
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 12,
                      letterSpacing: '0.02em',
                      color: 'var(--seed-muted)',
                      textTransform: 'uppercase',
                    }}
                   data-qoder-id="qel-text-d96a353b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-d96a353b&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:525,&quot;column&quot;:19}}">
                    <GlobalOutlined style={{ marginRight: 6 }}  data-qoder-id="qel-globaloutlined-4b706d5d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-globaloutlined-4b706d5d&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;globaloutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:536,&quot;column&quot;:21}}"/>
                    Base URL
                  </Text>
                  <Flex gap={8} data-qoder-id="qel-flex-fbc6caf2" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-fbc6caf2&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:539,&quot;column&quot;:19}}">
                    <Select
                      value={showCustomInput ? '__custom__' : baseURL}
                      onChange={handleProviderChange}
                      style={{ flex: 1, minWidth: 0 }}
                      size="large"
                      options={[
                        ...PROVIDERS.map((p) => ({
                          label: (
                            <Flex align="center" gap={8}>
                              <Badge
                                status="processing"
                                color="var(--seed-primary)"
                              />
                              <span>{p.label}</span>
                              <Text
                                type="secondary"
                                style={{ fontSize: 11, fontFamily: 'monospace' }}
                              >
                                {p.value.replace(/^https?:\/\//, '')}
                              </Text>
                            </Flex>
                          ),
                          value: p.value,
                        })),
                        {
                          label: (
                            <Space>
                              <LinkOutlined />
                              <span>自定义 URL</span>
                            </Space>
                          ),
                          value: '__custom__',
                        },
                      ]}
                     data-qoder-id="qel-select-bc2657a1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-select-bc2657a1&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;select&quot;,&quot;loc&quot;:{&quot;line&quot;:540,&quot;column&quot;:21}}"/>
                    {showCustomInput && (
                      <Input
                        placeholder="https://your-api.com"
                        value={customURL}
                        onChange={(e) => setCustomURL(e.target.value)}
                        size="large"
                        style={{ flex: 1, minWidth: 0 }}
                       data-qoder-id="qel-input-1604c5c6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-input-1604c5c6&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;input&quot;,&quot;loc&quot;:{&quot;line&quot;:576,&quot;column&quot;:23}}"/>
                    )}
                  </Flex>
                </Col>
              </Row>

              {/* ── Model Name ──────────────────────────────── */}
              <Row gutter={[16, 16]} style={{ marginTop: 4 }} data-qoder-id="qel-row-0d26486f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-row-0d26486f&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;row&quot;,&quot;loc&quot;:{&quot;line&quot;:589,&quot;column&quot;:15}}">
                <Col xs={24} md={8} data-qoder-id="qel-col-f401fc70" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-f401fc70&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:590,&quot;column&quot;:17}}">
                  <Text
                    strong
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 12,
                      letterSpacing: '0.02em',
                      color: 'var(--seed-muted)',
                      textTransform: 'uppercase',
                    }}
                   data-qoder-id="qel-text-d86c723f" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-d86c723f&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:591,&quot;column&quot;:19}}">
                    <RobotOutlined style={{ marginRight: 6 }}  data-qoder-id="qel-robotoutlined-d89a0f4e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-robotoutlined-d89a0f4e&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;robotoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:602,&quot;column&quot;:21}}"/>
                    测试模型名称
                  </Text>
                  <AutoComplete
                    value={modelName}
                    onChange={setModelName}
                    options={
                      models.length > 0
                        ? models.map((m) => ({
                            value: m.id,
                            label: (
                              <Flex align="center" gap={6}>
                                <Text code style={{ fontSize: 11 }}>{m.id}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {m.owned_by || ''}
                                </Text>
                              </Flex>
                            ),
                          }))
                        : [
                            { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
                            { value: 'gpt-4o', label: 'gpt-4o' },
                            { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
                            { value: 'claude-sonnet-4-20250514', label: 'claude-sonnet-4-20250514' },
                            { value: 'deepseek-chat', label: 'deepseek-chat' },
                            { value: 'agnes-2.0-flash', label: 'agnes-2.0-flash' },
                          ]
                    }
                    placeholder="输入模型名称，如 gpt-4o-mini"
                    size="large"
                    style={{ width: '100%' }}
                    allowClear
                    filterOption={(input, option) =>
                      (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                   data-qoder-id="qel-autocomplete-47fce2bb" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-autocomplete-47fce2bb&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;autocomplete&quot;,&quot;loc&quot;:{&quot;line&quot;:605,&quot;column&quot;:19}}"/>
                </Col>
                <Col xs={24} md={16} data-qoder-id="qel-col-00020f54" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-00020f54&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:639,&quot;column&quot;:17}}">
                  {activeURL && (
                    <Flex
                      align="center"
                      gap={8}
                      style={{
                        marginTop: 28,
                        padding: '8px 12px',
                        background: 'var(--seed-surface)',
                        borderRadius: 6,
                      }}
                     data-qoder-id="qel-flex-8abf5d4a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-8abf5d4a&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:641,&quot;column&quot;:21}}">
                      <Text type="secondary" style={{ fontSize: 12 }} data-qoder-id="qel-text-55786ff9" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-55786ff9&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:651,&quot;column&quot;:23}}">
                        目标端点:
                      </Text>
                      <Text
                        code
                        style={{ fontSize: 12, wordBreak: 'break-all' }}
                       data-qoder-id="qel-text-52786b40" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-52786b40&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:654,&quot;column&quot;:23}}">
                        {activeURL}/v1/chat/completions
                      </Text>
                    </Flex>
                  )}
                </Col>
              </Row>
            </Card>

            {/* ── Test sections grid ──────────────────────── */}
            <Row gutter={[20, 20]} data-qoder-id="qel-row-12288ee5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-row-12288ee5&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;row&quot;,&quot;loc&quot;:{&quot;line&quot;:667,&quot;column&quot;:13}}">
              {/* ── Test 1: Models ────────────────────────── */}
              <Col xs={24} lg={12} data-qoder-id="qel-col-f2f0b1bc" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-f2f0b1bc&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:669,&quot;column&quot;:15}}">
                <Card
                  data-component="Model List Test"
                  data-od-id="model-test"
                  title={
                    <Flex align="center" gap={8} data-qoder-id="qel-flex-84bf53d8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-84bf53d8&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:674,&quot;column&quot;:21}}">
                      <DashboardOutlined  data-qoder-id="qel-dashboardoutlined-b733f43d" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-dashboardoutlined-b733f43d&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;dashboardoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:675,&quot;column&quot;:23}}"/>
                      <span style={{ letterSpacing: '0.02em' }} data-qoder-id="qel-span-e57f2b04" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-e57f2b04&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:676,&quot;column&quot;:23}}">
                        测试一：模型列表
                      </span>
                    </Flex>
                  }
                  extra={
                    modelDuration != null && (
                      <Tag
                        color="blue"
                        icon={<ClockCircleOutlined  data-qoder-id="qel-clockcircleoutlined-6d02cb65" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-clockcircleoutlined-6d02cb65&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;clockcircleoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:685,&quot;column&quot;:31}}"/>}
                        style={{ borderRadius: 9999, letterSpacing: '0.02em' }}
                       data-qoder-id="qel-tag-7b58f787" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-tag-7b58f787&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;tag&quot;,&quot;loc&quot;:{&quot;line&quot;:683,&quot;column&quot;:23}}">
                        {modelDuration} ms
                      </Tag>
                    )
                  }
                  style={{ height: '100%' }}
                 data-qoder-id="qel-model-list-test-65ffe704" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-model-list-test-65ffe704&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;model-list-test&quot;,&quot;loc&quot;:{&quot;line&quot;:670,&quot;column&quot;:17}}">
                  <Button
                    type="primary"
                    icon={<SearchOutlined  data-qoder-id="qel-searchoutlined-ce8dc36b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-searchoutlined-ce8dc36b&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;searchoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:696,&quot;column&quot;:27}}"/>}
                    loading={modelLoading}
                    disabled={!isConfigReady}
                    onClick={handleFetchModels}
                    block
                    size="large"
                   data-qoder-id="qel-button-c69cdc62" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-c69cdc62&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:694,&quot;column&quot;:19}}">
                    获取模型列表
                  </Button>

                  {modelError && (
                    <Alert
                      type="error"
                      message="请求失败"
                      description={modelError}
                      showIcon
                      closable
                      style={{ marginTop: 16 }}
                     data-qoder-id="qel-alert-4e9e2404" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-alert-4e9e2404&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;alert&quot;,&quot;loc&quot;:{&quot;line&quot;:707,&quot;column&quot;:21}}"/>
                  )}

                  {modelLoading && (
                    <Flex justify="center" style={{ padding: '32px 0' }} data-qoder-id="qel-flex-f4c242bf" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-f4c242bf&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:718,&quot;column&quot;:21}}">
                      <Spin tip="正在获取模型列表..." size="default"  data-qoder-id="qel-spin-3400cbc6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-spin-3400cbc6&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;spin&quot;,&quot;loc&quot;:{&quot;line&quot;:719,&quot;column&quot;:23}}"/>
                    </Flex>
                  )}

                  {!modelLoading && models.length > 0 && (
                    <Table
                      dataSource={models.map((m, i) => ({
                        ...m,
                        key: m.id || i,
                      }))}
                      columns={modelColumns}
                      pagination={{
                        pageSize: 8,
                        size: 'small',
                        showSizeChanger: false,
                      }}
                      size="small"
                      style={{ marginTop: 16 }}
                      scroll={{ y: 320 }}
                     data-qoder-id="qel-table-ccd13d83" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-table-ccd13d83&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;table&quot;,&quot;loc&quot;:{&quot;line&quot;:724,&quot;column&quot;:21}}"/>
                  )}

                  {!modelLoading &&
                    !modelError &&
                    models.length === 0 &&
                    modelDuration === null && (
                      <Flex justify="center" style={{ padding: '24px 0' }} data-qoder-id="qel-flex-f5c24452" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-f5c24452&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:745,&quot;column&quot;:23}}">
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="点击按钮获取模型列表"
                         data-qoder-id="qel-empty-cc008cb5" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-empty-cc008cb5&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;empty&quot;,&quot;loc&quot;:{&quot;line&quot;:746,&quot;column&quot;:25}}"/>
                      </Flex>
                    )}

                  {!modelLoading &&
                    !modelError &&
                    models.length === 0 &&
                    modelDuration !== null && (
                      <Alert
                        type="info"
                        message="该端点返回了空的模型列表"
                        showIcon
                        style={{ marginTop: 16 }}
                       data-qoder-id="qel-alert-489e1a92" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-alert-489e1a92&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;alert&quot;,&quot;loc&quot;:{&quot;line&quot;:757,&quot;column&quot;:23}}"/>
                    )}
                </Card>
              </Col>

              {/* ── Test 2: Latency ───────────────────────── */}
              <Col xs={24} lg={12} data-qoder-id="qel-col-7af60502" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-7af60502&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:768,&quot;column&quot;:15}}">
                <Card
                  data-component="Latency Test"
                  data-od-id="latency-test"
                  title={
                    <Flex align="center" gap={8} data-qoder-id="qel-flex-80bad05e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-80bad05e&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:773,&quot;column&quot;:21}}">
                      <ThunderboltOutlined  data-qoder-id="qel-thunderboltoutlined-e6da60ef" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-thunderboltoutlined-e6da60ef&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;thunderboltoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:774,&quot;column&quot;:23}}"/>
                      <span style={{ letterSpacing: '0.02em' }} data-qoder-id="qel-span-ed83b4ca" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-span-ed83b4ca&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;span&quot;,&quot;loc&quot;:{&quot;line&quot;:775,&quot;column&quot;:23}}">
                        测试二：连通性与延迟
                      </span>
                    </Flex>
                  }
                  extra={
                    latencyResults.length > 0 && (
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined  data-qoder-id="qel-reloadoutlined-4b597bf6" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-reloadoutlined-4b597bf6&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;reloadoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:785,&quot;column&quot;:31}}"/>}
                        onClick={() => {
                          setLatencyResults([]);
                          setLatencyError(null);
                        }}
                       data-qoder-id="qel-button-d29f2ddd" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-d29f2ddd&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:782,&quot;column&quot;:23}}">
                        清除
                      </Button>
                    )
                  }
                  style={{ height: '100%' }}
                 data-qoder-id="qel-latency-test-8c3433b4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-latency-test-8c3433b4&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;latency-test&quot;,&quot;loc&quot;:{&quot;line&quot;:769,&quot;column&quot;:17}}">
                  <Button
                    type="primary"
                    icon={<SendOutlined  data-qoder-id="qel-sendoutlined-545e2236" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-sendoutlined-545e2236&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;sendoutlined&quot;,&quot;loc&quot;:{&quot;line&quot;:799,&quot;column&quot;:27}}"/>}
                    loading={latencyLoading}
                    disabled={!isConfigReady}
                    onClick={handleLatencyTest}
                    block
                    size="large"
                   data-qoder-id="qel-button-d09f2ab7" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-button-d09f2ab7&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;button&quot;,&quot;loc&quot;:{&quot;line&quot;:797,&quot;column&quot;:19}}">
                    发送测试请求
                  </Button>

                  {latencyError && (
                    <Alert
                      type="error"
                      message="请求失败"
                      description={latencyError}
                      showIcon
                      closable
                      style={{ marginTop: 16 }}
                     data-qoder-id="qel-alert-40a04c91" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-alert-40a04c91&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;alert&quot;,&quot;loc&quot;:{&quot;line&quot;:810,&quot;column&quot;:21}}"/>
                  )}

                  {latencyLoading && (
                    <Flex justify="center" style={{ padding: '32px 0' }} data-qoder-id="qel-flex-84bd1541" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-84bd1541&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:821,&quot;column&quot;:21}}">
                      <Spin tip="正在测试连通性与延迟..."  data-qoder-id="qel-spin-44056224" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-spin-44056224&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;spin&quot;,&quot;loc&quot;:{&quot;line&quot;:822,&quot;column&quot;:23}}"/>
                    </Flex>
                  )}

                  {/* latest result stats */}
                  {!latencyLoading && latencyResults.length > 0 && (
                    <div style={{ marginTop: 16 }} data-qoder-id="qel-div-10004861" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-10004861&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:828,&quot;column&quot;:21}}">
                      <Row gutter={[12, 12]} data-qoder-id="qel-row-a2302d5a" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-row-a2302d5a&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;row&quot;,&quot;loc&quot;:{&quot;line&quot;:829,&quot;column&quot;:23}}">
                        <Col span={8} data-qoder-id="qel-col-84f85357" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-84f85357&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:830,&quot;column&quot;:25}}">
                          <Card size="small" style={{ background: 'var(--seed-surface)', border: 'none' }} data-qoder-id="qel-card-6f18b9f0" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-card-6f18b9f0&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;card&quot;,&quot;loc&quot;:{&quot;line&quot;:831,&quot;column&quot;:27}}">
                            <Statistic
                              title={
                                <Text
                                  type="secondary"
                                  style={{ fontSize: 11, letterSpacing: '0.02em' }}
                                >
                                  状态码
                                </Text>
                              }
                              value={latencyResults[0].status}
                              valueStyle={{
                                color:
                                  latencyResults[0].status >= 200 &&
                                  latencyResults[0].status < 300
                                    ? 'var(--seed-accent)'
                                    : 'var(--seed-danger)',
                                fontSize: 24,
                                fontWeight: 600,
                                fontFamily: 'monospace',
                              }}
                             data-qoder-id="qel-statistic-7a4fdc79" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statistic-7a4fdc79&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;statistic&quot;,&quot;loc&quot;:{&quot;line&quot;:832,&quot;column&quot;:29}}"/>
                          </Card>
                        </Col>
                        <Col span={8} data-qoder-id="qel-col-85f854ea" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-85f854ea&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:855,&quot;column&quot;:25}}">
                          <Card size="small" style={{ background: 'var(--seed-surface)', border: 'none' }} data-qoder-id="qel-card-7c18ce67" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-card-7c18ce67&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;card&quot;,&quot;loc&quot;:{&quot;line&quot;:856,&quot;column&quot;:27}}">
                            <Statistic
                              title={
                                <Text
                                  type="secondary"
                                  style={{ fontSize: 11, letterSpacing: '0.02em' }}
                                >
                                  <FieldTimeOutlined /> TTFT
                                </Text>
                              }
                              value={latencyResults[0].ttft ?? '-'}
                              suffix={latencyResults[0].ttft != null ? 'ms' : ''}
                              valueStyle={{
                                fontSize: 24,
                                fontWeight: 600,
                                fontFamily: 'monospace',
                              }}
                             data-qoder-id="qel-statistic-834feaa4" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statistic-834feaa4&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;statistic&quot;,&quot;loc&quot;:{&quot;line&quot;:857,&quot;column&quot;:29}}"/>
                          </Card>
                        </Col>
                        <Col span={8} data-qoder-id="qel-col-f70ecd1c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-col-f70ecd1c&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;col&quot;,&quot;loc&quot;:{&quot;line&quot;:876,&quot;column&quot;:25}}">
                          <Card size="small" style={{ background: 'var(--seed-surface)', border: 'none' }} data-qoder-id="qel-card-7b1b0b6b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-card-7b1b0b6b&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;card&quot;,&quot;loc&quot;:{&quot;line&quot;:877,&quot;column&quot;:27}}">
                            <Statistic
                              title={
                                <Text
                                  type="secondary"
                                  style={{ fontSize: 11, letterSpacing: '0.02em' }}
                                >
                                  <ClockCircleOutlined /> 总延迟
                                </Text>
                              }
                              value={latencyResults[0].totalDuration ?? '-'}
                              suffix={
                                latencyResults[0].totalDuration != null ? 'ms' : ''
                              }
                              valueStyle={{
                                fontSize: 24,
                                fontWeight: 600,
                                fontFamily: 'monospace',
                              }}
                             data-qoder-id="qel-statistic-0452f44e" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-statistic-0452f44e&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;statistic&quot;,&quot;loc&quot;:{&quot;line&quot;:878,&quot;column&quot;:29}}"/>
                          </Card>
                        </Col>
                      </Row>

                      {latencyResults[0].content && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: '10px 14px',
                            background: 'var(--seed-surface)',
                            borderRadius: 6,
                            border: '1px solid var(--seed-border)',
                          }}
                         data-qoder-id="qel-div-07160085" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-div-07160085&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;div&quot;,&quot;loc&quot;:{&quot;line&quot;:902,&quot;column&quot;:25}}">
                          <Text
                            type="secondary"
                            style={{ fontSize: 11, letterSpacing: '0.02em', textTransform: 'uppercase' }}
                           data-qoder-id="qel-text-e88251be" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-e88251be&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:911,&quot;column&quot;:27}}">
                            响应片段
                          </Text>
                          <Paragraph
                            code
                            style={{
                              marginTop: 4,
                              marginBottom: 0,
                              fontSize: 12,
                              lineHeight: 1.5,
                              wordBreak: 'break-all',
                            }}
                           data-qoder-id="qel-paragraph-64664e07" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-paragraph-64664e07&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;paragraph&quot;,&quot;loc&quot;:{&quot;line&quot;:917,&quot;column&quot;:27}}">
                            {latencyResults[0].content.slice(0, 200)}
                          </Paragraph>
                        </div>
                      )}

                      {latencyResults.length > 1 && (
                        <>
                          <Divider
                            style={{ margin: '16px 0 12px' }}
                            plain
                           data-qoder-id="qel-divider-0c313fba" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-divider-0c313fba&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;divider&quot;,&quot;loc&quot;:{&quot;line&quot;:934,&quot;column&quot;:27}}">
                            <Text
                              type="secondary"
                              style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}
                             data-qoder-id="qel-text-e782502b" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-e782502b&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:938,&quot;column&quot;:29}}">
                              历史记录
                            </Text>
                          </Divider>
                          <Table
                            dataSource={latencyResults.map((r, i) => ({
                              ...r,
                              key: `latency-${i}-${r.timestamp}`,
                            }))}
                            columns={latencyColumns}
                            pagination={false}
                            size="small"
                            scroll={{ y: 200 }}
                           data-qoder-id="qel-table-ccb0e9d8" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-table-ccb0e9d8&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;table&quot;,&quot;loc&quot;:{&quot;line&quot;:945,&quot;column&quot;:27}}"/>
                        </>
                      )}
                    </div>
                  )}

                  {!latencyLoading &&
                    !latencyError &&
                    latencyResults.length === 0 && (
                      <Flex justify="center" style={{ padding: '24px 0' }} data-qoder-id="qel-flex-fbb581d1" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-fbb581d1&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:963,&quot;column&quot;:23}}">
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="点击按钮发送测试请求"
                         data-qoder-id="qel-empty-4c0a5091" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-empty-4c0a5091&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;empty&quot;,&quot;loc&quot;:{&quot;line&quot;:964,&quot;column&quot;:25}}"/>
                      </Flex>
                    )}
                </Card>
              </Col>
            </Row>

            {/* ── Footer note ─────────────────────────────── */}
            <Flex
              justify="center"
              style={{ padding: '8px 0 16px' }}
             data-qoder-id="qel-flex-77b8839c" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-flex-77b8839c&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;flex&quot;,&quot;loc&quot;:{&quot;line&quot;:975,&quot;column&quot;:13}}">
              <Text
                type="secondary"
                style={{ fontSize: 12, letterSpacing: '0.01em' }}
               data-qoder-id="qel-text-54853a59" data-qoder-source="{&quot;qoderId&quot;:&quot;qel-text-54853a59&quot;,&quot;filePath&quot;:&quot;react-vite/src/App.jsx&quot;,&quot;componentName&quot;:&quot;App&quot;,&quot;elementRole&quot;:&quot;text&quot;,&quot;loc&quot;:{&quot;line&quot;:979,&quot;column&quot;:15}}">
                所有请求直接从浏览器发出。如遇 CORS 错误，请检查目标 API 是否允许浏览器跨域访问，或配置本地代理。
              </Text>
            </Flex>
          </Flex>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
