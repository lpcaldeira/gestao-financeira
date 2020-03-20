﻿using Gomi.Infraestrutura.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Gomi.WebApp.ViewComponents
{
    [ViewComponent(Name = "RelatorioRelResumoGeral")]
    public class RelatorioRelResumoGeral : ViewComponent
    {
        private readonly IDashboardService _dashboardService;

        public RelatorioRelResumoGeral(IDashboardService dashboardService)
        {
            _dashboardService = dashboardService; 
        }

        public IViewComponentResult Invoke(int maxPriority, bool isDone)
        {
            var resultado = _dashboardService.ObterRelResumoGeral();
            return View(resultado);
           
        }
    }
}
