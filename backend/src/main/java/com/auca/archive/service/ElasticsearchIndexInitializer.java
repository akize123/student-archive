package com.auca.archive.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnBean(DocumentElasticsearchService.class)
public class ElasticsearchIndexInitializer implements ApplicationRunner {
    private final DocumentElasticsearchService documentElasticsearchService;

    public ElasticsearchIndexInitializer(DocumentElasticsearchService documentElasticsearchService) {
        this.documentElasticsearchService = documentElasticsearchService;
    }

    @Override
    public void run(ApplicationArguments args) {
        documentElasticsearchService.reindexAll();
    }
}
