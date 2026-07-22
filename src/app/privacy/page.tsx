import Link from "next/link";

export default function PrivacyPage() {
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "时迹运营方";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com";
  return (
    <main className="legal-page">
      <p className="eyebrow">PRIVACY</p>
      <h1>隐私政策</h1>
      <p className="legal-updated">更新日期：2026 年 7 月 21 日</p>
      <section><h2>1. 运营主体</h2><p>本服务由 {operator} 运营。如有隐私问题，可联系 {supportEmail}。</p></section>
      <section><h2>2. 收集的信息</h2><p>我们处理账号邮箱、加密后的密码凭据、登录会话、设备与网络安全信息，以及你主动创建的任务、分类、时间记录和备注。</p></section>
      <section><h2>3. 使用目的</h2><p>这些信息仅用于注册登录、邮箱验证、密码找回、跨设备同步、统计展示、保障账户安全和排查服务故障。</p></section>
      <section><h2>4. 存储与保护</h2><p>数据存储在中国大陆的腾讯云服务中，通过 HTTPS 传输，并采用账户隔离、访问控制、限流和数据库备份等措施保护。</p></section>
      <section><h2>5. 保存期限</h2><p>账号存续期间保存提供服务所需的数据。注销账号后删除账号及关联时间数据；依法需要保留的安全日志按法定期限保存。</p></section>
      <section><h2>6. 你的权利</h2><p>你可以在产品中查看和导出时间数据，也可以注销账号并删除云端数据。如需更正账号信息或提出其他请求，请通过上述邮箱联系我们。</p></section>
      <section><h2>7. 对外提供</h2><p>除提供云基础设施、邮件发送等必要服务外，我们不会出售个人信息。依法需要披露时，将按照适用法律处理。</p></section>
      <p className="legal-note">本页面是产品上线所需的初稿，正式发布前应由实际运营主体结合业务和律师意见复核。</p>
      <Link className="auth-back" href="/">返回时迹</Link>
    </main>
  );
}
