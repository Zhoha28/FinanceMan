const fs = require('fs').promises;
const path = require('path');

class JsonStore {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.ensureDataDirExists();
    }

    async ensureDataDirExists() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }
    }

    async readJson(filename) {
        const filePath = path.join(this.dataDir, filename);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return null;
            }
            throw err;
        }
    }

    async writeJson(filename, data) {
        const filePath = path.join(this.dataDir, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    async appendToArray(filename, newItems) {
        const existing = await this.readJson(filename) || [];
        const updated = Array.isArray(existing) ? [...existing, ...newItems] : newItems;
        await this.writeJson(filename, updated);
        return updated;
    }

    async updateById(filename, id, updates) {
        const data = await this.readJson(filename) || [];
        const index = data.findIndex(item => item.id === id);
        if (index === -1) throw new Error('Item not found');
        
        data[index] = { ...data[index], ...updates };
        await this.writeJson(filename, data);
        return data[index];
    }

    async deleteById(filename, id) {
        const data = await this.readJson(filename) || [];
        const filtered = data.filter(item => item.id !== id);
        await this.writeJson(filename, filtered);
        return true;
    }

    async findById(filename, id) {
        const data = await this.readJson(filename) || [];
        return data.find(item => item.id === id);
    }

    async query(filename, conditions = {}) {
        const data = await this.readJson(filename) || [];
        return data.filter(item => {
            return Object.entries(conditions).every(([key, value]) => item[key] === value);
        });
    }
}

module.exports = new JsonStore(path.join(__dirname, '..', 'data'));