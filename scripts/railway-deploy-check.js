#!/usr/bin/env node

/**
 * Railway部署前检查脚本
 * 检查项目是否准备好部署到Railway
 */

const fs = require('fs')

console.log('🚀 Railway部署前检查...\n')

const checks = [
  {
    name: 'Dockerfile存在',
    check: () => fs.existsSync('Dockerfile'),
    fix: '确保Dockerfile存在于项目根目录'
  },
  {
    name: 'railway.json配置',
    check: () => fs.existsSync('railway.json'),
    fix: '创建railway.json配置文件'
  },
  {
    name: 'package.json配置',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      return pkg.engines && pkg.engines.node && pkg.engines.node >= '18.0.0'
    },
    fix: '在package.json中设置engines.node >= 18.0.0'
  },
  {
    name: '环境变量示例文件',
    check: () => fs.existsSync('railway.env.example'),
    fix: '创建railway.env.example文件'
  },
  {
    name: '健康检查端点',
    check: () => {
      const appJs = fs.readFileSync('src/app.js', 'utf8')
      return appJs.includes('/health') || appJs.includes('health')
    },
    fix: '确保应用有/health端点'
  },
  {
    name: 'Redis依赖配置',
    check: () => {
      const config = fs.readFileSync('config/config.js', 'utf8')
      return config.includes('REDIS_HOST') || config.includes('REDIS_URL')
    },
    fix: '确保配置支持Redis环境变量'
  },
  {
    name: '端口配置',
    check: () => {
      const config = fs.readFileSync('config/config.js', 'utf8')
      return config.includes('process.env.PORT')
    },
    fix: '确保应用使用PORT环境变量'
  },
  {
    name: '生产环境优化',
    check: () => {
      const dockerfile = fs.readFileSync('Dockerfile', 'utf8')
      return dockerfile.includes('--omit=dev') || dockerfile.includes('--production')
    },
    fix: '确保Dockerfile使用生产依赖'
  }
]

let passed = 0
let failed = 0

checks.forEach(({ name, check, fix }) => {
  try {
    if (check()) {
      console.log(`✅ ${name}`)
      passed++
    } else {
      console.log(`❌ ${name}`)
      console.log(`   修复: ${fix}\n`)
      failed++
    }
  } catch (error) {
    console.log(`❌ ${name} (检查失败: ${error.message})`)
    console.log(`   修复: ${fix}\n`)
    failed++
  }
})

console.log('\n📊 检查结果:')
console.log(`✅ 通过: ${passed}`)
console.log(`❌ 失败: ${failed}`)

if (failed === 0) {
  console.log('\n🎉 项目已准备好部署到Railway!')
  console.log('\n📋 下一步:')
  console.log('1. 推送代码到GitHub')
  console.log('2. 在Railway中创建新项目')
  console.log('3. 连接GitHub仓库')
  console.log('4. 添加Redis服务')
  console.log('5. 配置环境变量')
  console.log('6. 部署应用')
} else {
  console.log('\n⚠️  请先修复上述问题后再部署')
  process.exit(1)
}
