import { createClient } from '@supabase/supabase-js';
import { supabaseApi } from './api';
import { mountApp } from './app';
import { readConfig } from './config';
import type { Database } from './database';
import { h } from './dom';
import './style.css';

const root = document.getElementById('app');
const config = readConfig(import.meta.env);

if (root && config) {
  mountApp(root, supabaseApi(createClient<Database>(config.supabaseUrl, config.supabaseAnonKey)), config);
} else if (root) {
  root.replaceChildren(
    h('section', { class: 'card' }, h('h1', {}, 'Configuração ausente'), h('p', {}, 'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).')),
  );
}
