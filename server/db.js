import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '..', 'portfolio.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      username TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      salt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      imageStorage TEXT DEFAULT 'local',
      imgbbApiKey TEXT DEFAULT '',
      cloudinaryCloudName TEXT DEFAULT '',
      cloudinaryUploadPreset TEXT DEFAULT '',
      supabaseUrl TEXT DEFAULT '',
      supabaseKey TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS about (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      roles TEXT DEFAULT '[]',
      bio TEXT DEFAULT '',
      profileImage TEXT DEFAULT '',
      resumeUrl TEXT DEFAULT '',
      statsProjects INTEGER DEFAULT 0,
      statsAchievements INTEGER DEFAULT 0,
      statsCertificates INTEGER DEFAULT 0,
      statsCustom TEXT DEFAULT '∞'
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      level INTEGER DEFAULT 50,
      visible INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT DEFAULT '',
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      liveUrl TEXT DEFAULT '',
      githubUrl TEXT DEFAULT '',
      featured INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS experience (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      company TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      description TEXT DEFAULT '',
      skills TEXT DEFAULT '[]',
      visible INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS education (
      id TEXT PRIMARY KEY,
      degree TEXT NOT NULL,
      institution TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      details TEXT DEFAULT '',
      visible INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      organization TEXT DEFAULT '',
      date TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      credentialUrl TEXT DEFAULT '',
      visible INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      organization TEXT DEFAULT '',
      date TEXT DEFAULT '',
      description TEXT DEFAULT '',
      visible INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS trainings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      organization TEXT DEFAULT '',
      date TEXT DEFAULT '',
      visible INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS contact (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      mapUrl TEXT DEFAULT '',
      socialLinks TEXT DEFAULT '{}'
    );
  `);
}

export function seedFromJson(jsonPath) {
  if (!fs.existsSync(jsonPath)) return;
  const setupRow = db.prepare("SELECT value FROM settings WHERE key = 'setup'").get();
  if (setupRow) return;

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    db.transaction(() => {
      if (data.setup !== undefined) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('setup', data.setup ? 'true' : 'false');
      }

      if (data.admin) {
        db.prepare('INSERT OR REPLACE INTO admin (id, username, passwordHash, salt) VALUES (1, ?, ?, ?)')
          .run(data.admin.username, data.admin.passwordHash, data.admin.salt);
      }

      if (data.config) {
        db.prepare(`INSERT OR REPLACE INTO config (id, imageStorage, imgbbApiKey, cloudinaryCloudName, cloudinaryUploadPreset, supabaseUrl, supabaseKey)
          VALUES (1, ?, ?, ?, ?, ?, ?)`)
          .run(
            data.config.imageStorage || 'local',
            data.config.imgbbApiKey || '',
            data.config.cloudinaryCloudName || '',
            data.config.cloudinaryUploadPreset || '',
            data.config.supabaseUrl || '',
            data.config.supabaseKey || ''
          );
      }

      if (data.about) {
        db.prepare(`INSERT OR REPLACE INTO about (id, name, roles, bio, profileImage, resumeUrl, statsProjects, statsAchievements, statsCertificates, statsCustom)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(
            data.about.name || '',
            JSON.stringify(data.about.roles || []),
            data.about.bio || '',
            data.about.profileImage || '',
            data.about.resumeUrl || '',
            data.about.stats?.projects || 0,
            data.about.stats?.achievements || 0,
            data.about.stats?.certificates || 0,
            data.about.stats?.custom || '∞'
          );
      }

      const insertSkill = db.prepare('INSERT OR REPLACE INTO skills (id, name, category, level, visible) VALUES (?, ?, ?, ?, ?)');
      for (const s of data.skills || []) {
        insertSkill.run(s.id, s.name, s.category, s.level, s.visible !== false ? 1 : 0);
      }

      const insertProject = db.prepare('INSERT OR REPLACE INTO projects (id, title, category, description, tags, images, liveUrl, githubUrl, featured, visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const p of data.projects || []) {
        insertProject.run(p.id, p.title, p.category, p.description, JSON.stringify(p.tags || []), JSON.stringify(p.images || []), p.liveUrl || '', p.githubUrl || '', p.featured ? 1 : 0, p.visible !== false ? 1 : 0);
      }

      const insertExp = db.prepare('INSERT OR REPLACE INTO experience (id, role, company, duration, description, skills, visible) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const e of data.experience || []) {
        insertExp.run(e.id, e.role, e.company, e.duration, e.description || '', JSON.stringify(e.skills || []), e.visible !== false ? 1 : 0);
      }

      const insertEdu = db.prepare('INSERT OR REPLACE INTO education (id, degree, institution, duration, details, visible) VALUES (?, ?, ?, ?, ?, ?)');
      for (const e of data.education || []) {
        insertEdu.run(e.id, e.degree, e.institution, e.duration, e.details || '', e.visible !== false ? 1 : 0);
      }

      const insertCert = db.prepare('INSERT OR REPLACE INTO certificates (id, title, organization, date, description, image, credentialUrl, visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const c of data.certificates || []) {
        insertCert.run(c.id, c.title, c.organization, c.date, c.description || '', c.image || '', c.credentialUrl || '', c.visible !== false ? 1 : 0);
      }

      const insertAch = db.prepare('INSERT OR REPLACE INTO achievements (id, title, organization, date, description, visible) VALUES (?, ?, ?, ?, ?, ?)');
      for (const a of data.achievements || []) {
        insertAch.run(a.id, a.title, a.organization, a.date, a.description || '', a.visible !== false ? 1 : 0);
      }

      const insertTrain = db.prepare('INSERT OR REPLACE INTO trainings (id, title, organization, date, visible) VALUES (?, ?, ?, ?, ?)');
      for (const t of data.trainings || []) {
        insertTrain.run(t.id, t.title, t.organization, t.date, t.visible !== false ? 1 : 0);
      }

      if (data.contact) {
        db.prepare(`INSERT OR REPLACE INTO contact (id, email, phone, address, mapUrl, socialLinks) VALUES (1, ?, ?, ?, ?, ?)`)
          .run(
            data.contact.email || '',
            data.contact.phone || '',
            data.contact.address || '',
            data.contact.mapUrl || '',
            JSON.stringify(data.contact.socialLinks || {})
          );
      }
    })();

    console.log('Database seeded from data.json');
  } catch (err) {
    console.error('Failed to seed database:', err);
  }
}

export function getFullData() {
  const setupRow = db.prepare("SELECT value FROM settings WHERE key = 'setup'").get();
  const setup = setupRow ? setupRow.value === 'true' : false;

  const admin = db.prepare('SELECT username, passwordHash, salt FROM admin WHERE id = 1').get() || null;

  const configRow = db.prepare('SELECT * FROM config WHERE id = 1').get() || {};
  const { id: _, ...config } = configRow;

  const aboutRow = db.prepare('SELECT * FROM about WHERE id = 1').get();
  const about = aboutRow ? {
    name: aboutRow.name,
    roles: JSON.parse(aboutRow.roles || '[]'),
    bio: aboutRow.bio,
    profileImage: aboutRow.profileImage,
    resumeUrl: aboutRow.resumeUrl,
    stats: {
      projects: aboutRow.statsProjects,
      achievements: aboutRow.statsAchievements,
      certificates: aboutRow.statsCertificates,
      custom: aboutRow.statsCustom
    }
  } : { name: '', roles: [], bio: '', profileImage: '', resumeUrl: '', stats: { projects: 0, achievements: 0, certificates: 0, custom: '∞' } };

  const skills = db.prepare('SELECT * FROM skills ORDER BY rowid').all().map(s => ({ id: s.id, name: s.name, category: s.category, level: s.level, visible: !!s.visible }));
  const projects = db.prepare('SELECT * FROM projects ORDER BY rowid').all().map(p => ({ id: p.id, title: p.title, category: p.category, description: p.description, tags: JSON.parse(p.tags || '[]'), images: JSON.parse(p.images || '[]'), liveUrl: p.liveUrl, githubUrl: p.githubUrl, featured: !!p.featured, visible: !!p.visible }));
  const experience = db.prepare('SELECT * FROM experience ORDER BY rowid').all().map(e => ({ id: e.id, role: e.role, company: e.company, duration: e.duration, description: e.description, skills: JSON.parse(e.skills || '[]'), visible: !!e.visible }));
  const education = db.prepare('SELECT * FROM education ORDER BY rowid').all().map(e => ({ id: e.id, degree: e.degree, institution: e.institution, duration: e.duration, details: e.details, visible: !!e.visible }));
  const certificates = db.prepare('SELECT * FROM certificates ORDER BY rowid').all().map(c => ({ id: c.id, title: c.title, organization: c.organization, date: c.date, description: c.description, image: c.image, credentialUrl: c.credentialUrl, visible: !!c.visible }));
  const achievements = db.prepare('SELECT * FROM achievements ORDER BY rowid').all().map(a => ({ id: a.id, title: a.title, organization: a.organization, date: a.date, description: a.description, visible: !!a.visible }));
  const trainings = db.prepare('SELECT * FROM trainings ORDER BY rowid').all().map(t => ({ id: t.id, title: t.title, organization: t.organization, date: t.date, visible: !!t.visible }));

  const contactRow = db.prepare('SELECT email, phone, address, mapUrl, socialLinks FROM contact WHERE id = 1').get();
  const contact = contactRow ? {
    email: contactRow.email,
    phone: contactRow.phone,
    address: contactRow.address,
    mapUrl: contactRow.mapUrl,
    socialLinks: JSON.parse(contactRow.socialLinks || '{}')
  } : { email: '', phone: '', address: '', mapUrl: '', socialLinks: {} };

  return { setup, admin, config, about, skills, projects, experience, education, certificates, achievements, trainings, contact };
}

export function saveFullData(data) {
  db.transaction(() => {
    if (data.setup !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('setup', data.setup ? 'true' : 'false');
    }

    if (data.admin) {
      const existing = db.prepare('SELECT id FROM admin WHERE id = 1').get();
      if (existing) {
        if (data.admin.passwordHash && data.admin.salt) {
          db.prepare('UPDATE admin SET username = ?, passwordHash = ?, salt = ? WHERE id = 1')
            .run(data.admin.username, data.admin.passwordHash, data.admin.salt);
        } else {
          db.prepare('UPDATE admin SET username = ? WHERE id = 1').run(data.admin.username);
        }
      } else {
        db.prepare('INSERT INTO admin (id, username, passwordHash, salt) VALUES (1, ?, ?, ?)')
          .run(data.admin.username, data.admin.passwordHash || '', data.admin.salt || '');
      }
    }

    if (data.config) {
      db.prepare(`INSERT OR REPLACE INTO config (id, imageStorage, imgbbApiKey, cloudinaryCloudName, cloudinaryUploadPreset, supabaseUrl, supabaseKey)
        VALUES (1, ?, ?, ?, ?, ?, ?)`)
        .run(
          data.config.imageStorage || 'local',
          data.config.imgbbApiKey || '',
          data.config.cloudinaryCloudName || '',
          data.config.cloudinaryUploadPreset || '',
          data.config.supabaseUrl || '',
          data.config.supabaseKey || ''
        );
    }

    if (data.about) {
      db.prepare(`INSERT OR REPLACE INTO about (id, name, roles, bio, profileImage, resumeUrl, statsProjects, statsAchievements, statsCertificates, statsCustom)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          data.about.name || '',
          JSON.stringify(data.about.roles || []),
          data.about.bio || '',
          data.about.profileImage || '',
          data.about.resumeUrl || '',
          data.about.stats?.projects || 0,
          data.about.stats?.achievements || 0,
          data.about.stats?.certificates || 0,
          data.about.stats?.custom || '∞'
        );
    }

    if (data.skills) {
      db.prepare('DELETE FROM skills').run();
      const insert = db.prepare('INSERT INTO skills (id, name, category, level, visible) VALUES (?, ?, ?, ?, ?)');
      for (const s of data.skills) {
        insert.run(s.id, s.name, s.category, s.level, s.visible !== false ? 1 : 0);
      }
    }

    if (data.projects) {
      db.prepare('DELETE FROM projects').run();
      const insert = db.prepare('INSERT INTO projects (id, title, category, description, tags, images, liveUrl, githubUrl, featured, visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const p of data.projects) {
        insert.run(p.id, p.title, p.category, p.description, JSON.stringify(p.tags || []), JSON.stringify(p.images || []), p.liveUrl || '', p.githubUrl || '', p.featured ? 1 : 0, p.visible !== false ? 1 : 0);
      }
    }

    if (data.experience) {
      db.prepare('DELETE FROM experience').run();
      const insert = db.prepare('INSERT INTO experience (id, role, company, duration, description, skills, visible) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const e of data.experience) {
        insert.run(e.id, e.role, e.company, e.duration, e.description || '', JSON.stringify(e.skills || []), e.visible !== false ? 1 : 0);
      }
    }

    if (data.education) {
      db.prepare('DELETE FROM education').run();
      const insert = db.prepare('INSERT INTO education (id, degree, institution, duration, details, visible) VALUES (?, ?, ?, ?, ?, ?)');
      for (const e of data.education) {
        insert.run(e.id, e.degree, e.institution, e.duration, e.details || '', e.visible !== false ? 1 : 0);
      }
    }

    if (data.certificates) {
      db.prepare('DELETE FROM certificates').run();
      const insert = db.prepare('INSERT INTO certificates (id, title, organization, date, description, image, credentialUrl, visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const c of data.certificates) {
        insert.run(c.id, c.title, c.organization, c.date, c.description || '', c.image || '', c.credentialUrl || '', c.visible !== false ? 1 : 0);
      }
    }

    if (data.achievements) {
      db.prepare('DELETE FROM achievements').run();
      const insert = db.prepare('INSERT INTO achievements (id, title, organization, date, description, visible) VALUES (?, ?, ?, ?, ?, ?)');
      for (const a of data.achievements) {
        insert.run(a.id, a.title, a.organization, a.date, a.description || '', a.visible !== false ? 1 : 0);
      }
    }

    if (data.trainings) {
      db.prepare('DELETE FROM trainings').run();
      const insert = db.prepare('INSERT INTO trainings (id, title, organization, date, visible) VALUES (?, ?, ?, ?, ?)');
      for (const t of data.trainings) {
        insert.run(t.id, t.title, t.organization, t.date, t.visible !== false ? 1 : 0);
      }
    }

    if (data.contact) {
      db.prepare(`INSERT OR REPLACE INTO contact (id, email, phone, address, mapUrl, socialLinks) VALUES (1, ?, ?, ?, ?, ?)`)
        .run(
          data.contact.email || '',
          data.contact.phone || '',
          data.contact.address || '',
          data.contact.mapUrl || '',
          JSON.stringify(data.contact.socialLinks || {})
        );
    }
  })();
}
