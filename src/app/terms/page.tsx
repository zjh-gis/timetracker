import Link from "next/link";

export default function TermsPage() {
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "时迹运营方";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com";
  return (
    <main className="legal-page">
      <p className="eyebrow">TERMS</p>
      <h1>用户协议</h1>
      <p className="legal-updated">更新日期：2026 年 7 月 21 日</p>
      <section><h2>1. 服务说明</h2><p>{operator} 向注册用户提供个人时间记录、统计和跨设备同步服务。</p></section>
      <section><h2>2. 账号安全</h2><p>你应使用本人可正常接收邮件的邮箱注册，并妥善保管密码。发现账号异常时请及时重置密码或联系我们。</p></section>
      <section><h2>3. 使用规则</h2><p>不得利用服务实施违法行为、攻击服务、批量注册、干扰其他用户或上传明显超出个人时间记录用途的内容。</p></section>
      <section><h2>4. 数据备份</h2><p>我们会采取合理措施保护数据，但仍建议定期使用 JSON 导出功能保留个人备份。</p></section>
      <section><h2>5. 服务变更</h2><p>涉及用户权益的重要变更会通过产品页面或注册邮箱通知。停止服务时将预留合理的数据导出期限。</p></section>
      <section><h2>6. 联系方式</h2><p>服务问题可联系 {supportEmail}。</p></section>
      <p className="legal-note">本页面是产品上线所需的初稿，正式发布前应由实际运营主体结合业务和律师意见复核。</p>
      <Link className="auth-back" href="/">返回时迹</Link>
    </main>
  );
}
